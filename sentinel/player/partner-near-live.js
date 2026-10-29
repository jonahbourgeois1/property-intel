/* Memory-profile wrapper around the same rendered-frame player as operators.
 * Load hls.min.js, near_live_player.js and this file before partner-player.js.
 */
(function(root){
  'use strict';
  class SentinelNearLiveViewer {
    constructor({container,session,renewSession,cameraNames={}}){
      this.container=container;this.renewSession=renewSession;this.names=cameraNames;
      this.tiles=new Map();this.epoch=0;this.closed=false;this.suspended=false;
      this.skew=0;this.misses=0;this.controller=null;this.lastGood=0;
      this.visibility=()=>document.hidden?this.suspend():this.resume();
      this.pagehide=event=>event.persisted?this.suspend():this.destroy();
      this.pageshow=event=>{if(event.persisted)this.resume();};
      this.online=()=>this.resume();
      document.addEventListener('visibilitychange',this.visibility);
      window.addEventListener('pagehide',this.pagehide);
      window.addEventListener('pageshow',this.pageshow);
      window.addEventListener('online',this.online);
      this.watchTimer=setInterval(()=>this.watch(),1000);
      this.setSession(session);
    }
    setSession(session){
      if(this.closed)return;
      this.epoch++;this.controller?.abort();clearTimeout(this.pollTimer);clearTimeout(this.renewTimer);
      this.clearTiles();this.session=session;this.misses=0;this.lastGood=0;
      for(const stream of session.streams){
        const card=document.createElement('article'),title=document.createElement('h3');
        const video=document.createElement('video'),image=document.createElement('img'),status=document.createElement('p');
        title.textContent=this.names[stream.camera_id]||stream.camera_id;
        video.muted=true;video.autoplay=true;video.playsInline=true;video.controls=true;
        video.setAttribute('aria-label',title.textContent);image.alt='Recent snapshot';image.hidden=true;
        status.setAttribute('role','status');status.textContent='Starting video…';
        card.append(title,video,image,status);this.container.append(card);
        this.tiles.set(stream.camera_id,{card,video,image,status,stream,player:null,url:null,retired:false});
      }
      if(this.renewSession)this.renewTimer=setTimeout(()=>this.renew(),Math.max(1000,Date.parse(session.expires_at)-Date.now()-45000));
      if(this.suspended||document.hidden){
        this.suspended=true;
        if(session.suspend_url)navigator.sendBeacon(session.suspend_url);
        return;
      }
      this.poll();
    }
    detach(tile){tile.player?.destroy();tile.player=null;tile.url=null;}
    clearTiles(){
      for(const tile of this.tiles.values()){
        tile.retired=true;tile.snapshotAbort?.abort();this.detach(tile);if(tile.objectURL)URL.revokeObjectURL(tile.objectURL);tile.card.remove();
      }
      this.tiles.clear();
    }
    attach(tile,camera){
      // Never turn a fresh server status into a claim about displayed pixels.
      // Generation/source changes rebuild; ordinary polls never interrupt HLS.
      const url=camera.hls_url?new URL(camera.hls_url,this.session.status_url).href:null;
      if(tile.url!==url)this.detach(tile);
      if(!tile.player&&url){
        tile.player=new root.NearLivePlayer.Player(tile.video,{Hls:root.Hls,clock:()=>Date.now()+this.skew,
          deniedStatuses:[410],denied:()=>this.stop('Viewing access ended. Reopen the viewer.')});
        tile.url=url;tile.player.start(url);
      }
      if(tile.player?.native&&Number.isFinite(camera.media_age_seconds))
        tile.player.latestEnd=Date.now()+this.skew-camera.media_age_seconds*1000;
    }
    watch(){
      if(this.closed||this.suspended||document.hidden)return;
      for(const tile of this.tiles.values()){
        if(tile.retired)continue;
        if(tile.capacityLimited){
          tile.card.dataset.state='connecting';tile.status.textContent='Waiting for available camera capacity…';tile.image.hidden=true;continue;
        }
        const [state,text]=tile.player?.tick()||['connecting','Waiting for fresh video…'];
        tile.card.dataset.state=state;tile.status.textContent=text;
        if(state==='live')tile.image.hidden=true;
        if(['stale','delayed'].includes(state))this.fallback(tile);
        if(!tile.image.hidden&&Date.now()+this.skew-tile.captured>15000){
          tile.image.hidden=true;tile.image.removeAttribute('src');
        }
      }
    }
    async fallback(tile){
      if(!tile.stream.snapshot_url||tile.snapshotBusy||this.closed||this.suspended||tile.retired||
          Date.now()-(tile.lastSnapshot||0)<5000)return;
      const epoch=this.epoch,abort=new AbortController();tile.snapshotAbort=abort;tile.snapshotBusy=true;tile.lastSnapshot=Date.now();
      const timeout=setTimeout(()=>abort.abort(),5000);
      try{
        const response=await fetch(tile.stream.snapshot_url,{credentials:'omit',cache:'no-store',signal:abort.signal});
        if(epoch!==this.epoch||this.closed||tile.retired)return;
        if([401,403,410].includes(response.status)){this.stop('Viewing access ended. Reopen the viewer.');return;}
        if(!response.ok)return;
        const captured=Date.parse(response.headers.get('X-Snapshot-Captured-At'));
        const age=Number(response.headers.get('X-Media-Age-Seconds'));
        if(!Number.isFinite(captured)||!Number.isFinite(age)||age>15||Date.now()+this.skew-captured>15000)return;
        const blob=await response.blob();
        if(epoch!==this.epoch||this.closed||this.suspended||tile.retired||tile.player?.tick()[0]==='live'||
            Date.now()+this.skew-captured>15000)return;
        if(tile.objectURL)URL.revokeObjectURL(tile.objectURL);
        tile.objectURL=URL.createObjectURL(blob);tile.captured=captured;tile.image.src=tile.objectURL;tile.image.hidden=false;
        tile.image.alt='Snapshot captured '+new Date(captured).toLocaleTimeString();
        tile.status.textContent='Snapshot · '+new Date(captured).toLocaleTimeString();
      }catch(_error){/* The independent frame watchdog retains the stale label. */}
      finally{clearTimeout(timeout);tile.snapshotBusy=false;if(tile.snapshotAbort===abort)tile.snapshotAbort=null;}
    }
    async poll(){
      if(this.closed||this.suspended||document.hidden)return;
      const epoch=this.epoch,abort=new AbortController();this.controller=abort;
      const timeout=setTimeout(()=>abort.abort(),8000);
      try{
        const touch=await fetch(this.session.touch_url,{method:'POST',credentials:'omit',cache:'no-store',signal:abort.signal});
        if(epoch!==this.epoch||this.closed||this.suspended)return;
        if([401,403,404,410].includes(touch.status)){this.stop('Viewing access ended. Reopen the viewer.');return;}
        if(!touch.ok)throw Error('Viewing controls are reconnecting…');
        const started=Date.now();
        const response=await fetch(this.session.status_url,{credentials:'omit',cache:'no-store',signal:abort.signal});
        if(epoch!==this.epoch||this.closed||this.suspended)return;
        if([401,403,409].includes(response.status)){
          for(const tile of this.tiles.values())this.detach(tile);
          if(++this.misses>2){this.stop('Viewing access ended. Reopen the viewer.');return;}
          throw Error('Authorizing video…');
        }
        if([404,410].includes(response.status)){this.stop('Viewing access ended. Reopen the viewer.');return;}
        if(!response.ok)throw Error('Video service is reconnecting…');
        const data=await response.json();
        if(epoch!==this.epoch||this.closed||this.suspended)return;
        this.misses=0;this.lastGood=Date.now();
        if(Number.isFinite(data.server_time))this.skew=data.server_time*1000-started;
        for(const [cid,tile] of this.tiles){
          const camera=data.cameras.find(c=>c.camera_id===cid);
          if(!camera||camera.source_revision!==tile.stream.source_revision){
            this.detach(tile);tile.retired=true;tile.snapshotAbort?.abort();tile.image.hidden=true;
            tile.status.textContent='Camera source changed. Reopen the viewer.';continue;
          }
          tile.capacityLimited=camera.stream_state==='capacity_limited';
          this.attach(tile,camera);
        }
        this.watch();
      }catch(error){
        if(epoch===this.epoch&&!this.closed&&!this.suspended)
          for(const tile of this.tiles.values())if(!tile.player&&!tile.retired)tile.status.textContent=error.name==='AbortError'?'Controls reconnecting…':error.message;
      }finally{
        clearTimeout(timeout);if(this.controller===abort)this.controller=null;
        if(epoch===this.epoch&&!this.closed&&!this.suspended)this.pollTimer=setTimeout(()=>this.poll(),2000);
      }
    }
    async renew(){
      if(this.closed||this.suspended||document.hidden||!this.renewSession||this.renewing)return;
      const sessionId=this.session.session_id;this.renewing=true;
      try{
        const session=await this.renewSession(sessionId);
        if(this.closed&&session.close_url)navigator.sendBeacon(session.close_url);
        if(!this.closed&&this.session.session_id===sessionId)this.setSession(session);
      }catch(_error){if(!this.closed)this.stop('Viewing access could not be renewed. Reopen the viewer.');}
      finally{this.renewing=false;}
    }
    suspend(){
      if(this.closed||this.suspended)return;
      this.suspended=true;this.epoch++;this.controller?.abort();clearTimeout(this.pollTimer);
      if(this.session.suspend_url)navigator.sendBeacon(this.session.suspend_url);
      for(const tile of this.tiles.values()){this.detach(tile);tile.snapshotAbort?.abort();tile.image.hidden=true;}
    }
    resume(){
      if(this.closed||document.hidden)return;
      this.suspended=false;this.epoch++;this.controller?.abort();clearTimeout(this.pollTimer);
      if(this.renewSession&&Date.parse(this.session.expires_at)-Date.now()<45000)this.renew();else this.poll();
    }
    stop(message){
      this.closed=true;this.epoch++;this.controller?.abort();clearTimeout(this.pollTimer);clearTimeout(this.renewTimer);clearInterval(this.watchTimer);
      for(const tile of this.tiles.values()){this.detach(tile);tile.snapshotAbort?.abort();tile.image.hidden=true;tile.image.removeAttribute('src');tile.status.textContent=message;}
    }
    destroy(){
      if(!this.closed&&this.session.close_url)navigator.sendBeacon(this.session.close_url);
      this.stop('Viewer closed');this.clearTiles();
      document.removeEventListener('visibilitychange',this.visibility);window.removeEventListener('pagehide',this.pagehide);
      window.removeEventListener('pageshow',this.pageshow);window.removeEventListener('online',this.online);
    }
  }
  root.SentinelNearLiveViewer=SentinelNearLiveViewer;
})(typeof globalThis!=='undefined'?globalThis:this);
