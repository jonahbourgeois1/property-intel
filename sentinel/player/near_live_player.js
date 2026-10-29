/* Frame freshness and recovery are separate from management status polling. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.NearLivePlayer=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  class Player{
    constructor(video,options={}){
      this.video=video;this.options=options;this.Hls=options.Hls;
      this.now=options.now||(()=>Date.now());this.clock=options.clock||this.now;
      this.timer=options.setTimeout||setTimeout;this.clearTimer=options.clearTimeout||clearTimeout;
      this.started=this.now();this.listeners=[];this.destroyed=false;this.hls=null;
      this.frameStamp=null;this.frameAt=null;this.frameTime=null;this.latestEnd=null;
      this.frozen=false;this.userPaused=false;this.blocked=false;this.seekPending=false;
      this.seekAt=-Infinity;this.repairAt=-Infinity;this.repairs=0;this.retryDelay=1000;this.retryTimer=null;
      this.manifestParsed=false;this.url=null;this.native=false;
      this.sourceChanging=false;
      this.listen('pause',()=>{if(!this.frozen&&!this.destroyed&&!this.sourceChanging)this.userPaused=true;});
      this.listen('play',()=>{this.userPaused=false;this.blocked=false;});
      this.listen('playing',()=>{this.sourceChanging=false;});
      this.listen('seeked',()=>{this.seekPending=false;if(this.frozen)this.seekToFresh();});
      this.listen('timeupdate',()=>{
        if(!this.video.requestVideoFrameCallback&&!this.video.seeking&&this.video.readyState>=2)
          this.frame(this.video.currentTime);
      });
      this.listen('error',()=>this.recover('mediaError'));
      this.frameCallback=()=>{
        if(this.destroyed||!this.video.requestVideoFrameCallback)return;
        this.frameCallbackId=this.video.requestVideoFrameCallback((_now,metadata)=>{
          if(this.destroyed)return;
          this.frame(metadata.mediaTime);this.frameCallback();
        });
      };
      this.frameCallback();
    }
    listen(event,handler){this.video.addEventListener(event,handler);this.listeners.push([event,handler]);}
    mediaStamp(mediaTime){
      const pdt=this.hls?.playingDate;
      const stamp=pdt&&typeof pdt.getTime==='function'?pdt.getTime():NaN;
      if(Number.isFinite(stamp))return stamp+(mediaTime-this.video.currentTime)*1000;
      // Native HLS may expose a reliable wall-clock anchor. When it does not,
      // report unverified timing rather than borrowing the server's newest age.
      if(typeof this.video.getStartDate==='function'){
        const date=this.video.getStartDate(),start=date?.getTime();
        if(Number.isFinite(start))return start+mediaTime*1000;
      }
      return null;
    }
    frame(mediaTime){
      if(!Number.isFinite(mediaTime)||mediaTime===this.frameTime)return;
      this.frameTime=mediaTime;this.frameAt=this.now();this.frameStamp=this.mediaStamp(mediaTime);
      this.sourceChanging=false;
      this.retryDelay=1000;this.repairs=0;
      const age=this.frameStamp==null?null:this.clock()-this.frameStamp;
      if(this.frozen&&((age!=null&&age>=-3000&&age<15000)||(age==null&&this.nativeRecovery))){
        this.frozen=false;this.nativeRecovery=false;this.video.classList?.remove('stale');this.play();
      }
    }
    play(){
      if(this.destroyed||this.userPaused)return;
      const result=this.video.play();
      if(result?.catch)result.catch(()=>{if(!this.destroyed)this.blocked=true;});
    }
    start(url){
      if(this.destroyed)return;
      this.url=url;
      this.sourceChanging=true;
      const Hls=this.Hls;
      if(Hls&&Hls.isSupported()){
        const retry={maxNumRetry:3,retryDelayMs:1000,maxRetryDelayMs:4000};
        const policy=name=>({default:{...(Hls.DefaultConfig?.[name]?.default||{}),
          maxTimeToFirstByteMs:8000,maxLoadTimeMs:12000,errorRetry:{...retry},timeoutRetry:{...retry}}});
        this.hls=new Hls({enableWorker:true,liveSyncDuration:2.5,liveMaxLatencyDuration:8,
          backBufferLength:2,maxBufferLength:8,
          manifestLoadPolicy:policy('manifestLoadPolicy'),playlistLoadPolicy:policy('playlistLoadPolicy'),
          fragLoadPolicy:policy('fragLoadPolicy')});
        this.hls.on(Hls.Events.MANIFEST_PARSED,()=>{if(this.destroyed)return;this.manifestParsed=true;this.play();});
        this.hls.on(Hls.Events.LEVEL_UPDATED,(_event,data)=>{
          if(this.destroyed)return;
          const fragments=data?.details?.fragments,last=fragments?.[fragments.length-1];
          if(last&&Number.isFinite(last.programDateTime)&&Number.isFinite(last.duration))
            this.latestEnd=last.programDateTime+last.duration*1000;
          if(this.frozen)this.seekToFresh();
        });
        this.hls.on(Hls.Events.ERROR,(_event,data)=>{
          if(this.destroyed)return;
          if([401,403,...(this.options.deniedStatuses||[])].includes(data.response?.code)){this.options.denied?.();return;}
          // HLS owns retrying requests until they complete or exhaust their
          // real timeout/retry policy. Watch ticks never interrupt that work.
          if(data.fatal)this.recover(data.type,data.details||'');
        });
        this.hls.loadSource(url);this.hls.attachMedia(this.video);
      }else if(this.video.canPlayType('application/vnd.apple.mpegurl')){
        this.native=true;this.listen('loadedmetadata',()=>this.play());this.video.src=url;
      }else this.blocked=true;
    }
    recover(type,details=''){
      if(this.destroyed||this.retryTimer)return;
      if(type==='mediaError'&&this.hls&&this.repairs<2&&this.now()-this.repairAt>1000){
        this.repairs++;this.repairAt=this.now();this.sourceChanging=true;this.hls.recoverMediaError();return;
      }
      const delay=this.retryDelay;this.retryDelay=Math.min(4000,delay*2);
      this.retryTimer=this.timer(()=>{
        this.retryTimer=null;if(this.destroyed)return;
        if(this.hls){
          if(!this.manifestParsed||details.startsWith('manifest'))this.hls.loadSource(this.url);
          else if(type==='mediaError'){
            this.sourceChanging=true;
            this.hls.destroy();this.hls=null;this.manifestParsed=false;this.start(this.url);
          }else this.hls.startLoad();
        }else if(this.native){this.video.load();this.play();}
      },delay);
    }
    freeze(){
      if(this.frozen)return;
      this.frozen=true;this.video.classList?.add('stale');this.video.pause();
      // Keep playlist/fragment delivery alive. A stopped loader cannot discover
      // that fresh video has returned while the playhead is paused.
    }
    seekToFresh(){
      if(this.destroyed||this.userPaused)return;
      if(this.seekPending){
        if(this.now()-this.seekAt<15000)return;
        this.seekPending=false;
      }
      if(this.latestEnd==null||this.clock()-this.latestEnd>6000)return;
      const seekable=this.video.seekable;
      const target=this.hls?this.hls.liveSyncPosition:(this.native&&seekable?.length?Math.max(seekable.start(seekable.length-1),seekable.end(seekable.length-1)-2.5):NaN);
      if(!Number.isFinite(target))return;
      const ranges=this.video.buffered;
      let buffered=false;
      for(let i=0;ranges&&i<ranges.length;i++)if(target>=ranges.start(i)&&target<=ranges.end(i)){buffered=true;break;}
      if(this.now()-this.seekAt<1000)return;
      this.seekAt=this.now();
      if(Math.abs(this.video.currentTime-target)>.1){
        if(this.native)this.nativeRecovery=true;
        this.seekPending=true;this.video.currentTime=target;
      }
      if(buffered)this.play();
      // Remain grey until frame() confirms a new, recent displayed frame.
    }
    tick(){
      if(this.destroyed)return ['offline','Viewing ended'];
      if(this.userPaused)return ['paused','Paused — press Play to resume'];
      const age=this.frameStamp==null?null:this.clock()-this.frameStamp;
      const noFrames=this.now()-(this.frameAt??this.started);
      if((age!=null&&age>15000)||noFrames>15000)this.freeze();
      if(this.frozen){
        this.seekToFresh();
        return ['stale',this.frameStamp==null?'No fresh video — recovering…':'Video stopped updating — recovering…'];
      }
      if(this.blocked)return ['paused','Press Play to start video'];
      if(this.frameAt==null)return ['connecting','Loading live video…'];
      if(noFrames>2500)return ['delayed','Video stalled — recovering…'];
      if(!this.video.requestVideoFrameCallback)return ['playing','Video playing · frame freshness unverified'];
      if(age==null)return ['playing','Video playing · capture time unavailable'];
      if(age< -3000)return ['delayed','Camera clock needs checking'];
      if(age>=6000)return ['delayed','Delayed · '+Math.round(age/1000)+'s'];
      return ['live','Live · '+Math.max(0,age/1000).toFixed(1)+'s'];
    }
    destroy(){
      if(this.destroyed)return;this.destroyed=true;
      if(this.retryTimer)this.clearTimer(this.retryTimer);
      this.hls?.destroy();
      if(this.frameCallbackId!=null&&this.video.cancelVideoFrameCallback)this.video.cancelVideoFrameCallback(this.frameCallbackId);
      for(const [event,handler] of this.listeners)this.video.removeEventListener(event,handler);
      this.video.pause();this.video.removeAttribute('src');this.video.load();
    }
  }
  return {Player};
});
