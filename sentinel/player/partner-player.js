/* Stable public constructor for the default memory live viewer.
 * Backend callbacks perform API-key operations; this helper never receives a key.
 */
'use strict';
(() => {
  class SentinelSiteViewer {
    constructor(options) {
      if(options.session.media_engine!=='memory-v1')throw Error('This viewer requires the memory-v1 live service.');
      if(!window.SentinelNearLiveViewer||!window.NearLivePlayer)throw Error('Load near_live_player.js and partner-near-live.js before partner-player.js.');
      return new window.SentinelNearLiveViewer(options);
    }
  }
  window.SentinelSiteViewer=SentinelSiteViewer;
})();
