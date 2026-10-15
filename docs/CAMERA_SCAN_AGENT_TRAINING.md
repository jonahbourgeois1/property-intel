# Camera scan agent — training

**Audience:** a Grok agent whose only job is to review stored camera scans.
**Granted:** 2026-10-09, by Jonah. This file is the permission to review those scans. Do not ask again before each scan.
**Do not put secrets in this file.** No review key, no AWS secret, no dealer key, no property password.

## 1. Job

Review one stored scan at a time.

You are given two pictures of the same camera: the new frame, and the previous frame. Write `description` only when the new frame shows something irregular that was not already in the previous frame: a person, a vehicle, or an object that does not belong in the usual scene.

Leave `description` empty otherwise. An empty description is the normal result. A standing condition that appears in both frames stays empty. Do not write a changelog of differences. Do not label anyone a trespasser. The pictures are the evidence.

The first frame for a camera has no previous picture. That baseline is not a review. The route will not hand it to you.

You do not grab a live frame. You do not call CHEKT. You do not hold the dealer key, a property password, or an AWS key.

## 2. Ask for one pair

```text
GET https://script.google.com/macros/s/AKfycbzHkj4fNRBJ7839babxL2Gp1A2ka9Em05rOQRZUNg_X0lMrOAMEKtEXEXxuU9_u7iKERA/exec?route=scan-next&review_key={review_key}
```

`review_key` is in the task message Jonah sends you. It is Script Property `SCAN_REVIEW_KEY`. Do not write it into this file, a scan record, or a log.

`pending: false` means nothing is waiting right now. Wait 5 minutes, then call `scan-next` again. Patrol keeps storing frames through the day. Do not stop for the day. Do not call it faster than that while it stays `pending: false`.

`indexing: true` and no `key` means the script is still lining up older frames. Call `scan-next` again. Do not write a review for that response. The first frame of a camera is the baseline and is not sent to you. Each later frame is paired with the one immediately before it, oldest first, for every camera.

A pair looks like this:

```json
{
  "ok": true,
  "pending": true,
  "key": "camera-scans/{hub}/{device}/{stamp}.json",
  "hub": "32-hex",
  "device_id": "4350156",
  "name": "DRIVEWAY",
  "requested_at": "2026-10-09T21:00:00.000Z",
  "previous": "camera-scans/{hub}/{device}/{earlier}.jpg",
  "jpeg_base64": "<new jpeg>",
  "previous_base64": "<previous jpeg>"
}
```

`jpeg_base64` is the new frame. `previous_base64` is the frame before it. Decode both and look at them. Do not store the base64 in the review you send back.

## 3. Write the review

One POST. The script overwrites that same JSON. The JPEG and the stamp stay put.

Put `review_key`, `key`, and `description` in the query string as well as the body. URL-encode each value. Google answers the POST with a redirect, and a client that follows it as a GET drops the body. The query string is what still gets saved.

```text
POST https://script.google.com/macros/s/AKfycbzHkj4fNRBJ7839babxL2Gp1A2ka9Em05rOQRZUNg_X0lMrOAMEKtEXEXxuU9_u7iKERA/exec?route=scan-review&review_key={review_key}&key={key}&description={description}
Content-Type: text/plain

{"route":"scan-review","review_key":"{review_key}","key":"{key}","description":""}
```

Use `text/plain`. `application/json` triggers a preflight the web app cannot answer.

Follow the redirect once, as a GET, to the `Location` URL only. Read that JSON. Do not send a fresh GET to the `/exec` URL unless `key` and `review_key` are still on it.

`key` is the `key` from `scan-next`. `description` is `""` or one sentence, at most 280 characters. The script sets `reviewed_at`. You do not send a time.

`ok: true` means that key is saved, including `already: true` when it was saved earlier. Anything else is not saved: `unknown route`, `not found`, an HTML page, a timeout, an interrupted run, or a network error. Retry this same key. Do not call `scan-next` for a new pair until this key returns `ok: true`.

Then call `scan-next` again. Keep going through `indexing: true` responses. A `pending: false` response means wait 5 minutes and call again. The patrol schedule stores new frames all day, and the next call picks those up. If the computer cannot reach the server, wait and retry the same key. The server still holds the pair.

For a Tracy pair, hub `d9f759d7351db3886c79dd689c41e3c0`, follow section 6 before this POST once his profile reads `saved: true`. Tracy is a he. Other hubs stay on the rule in section 1.

## 4. Allowed writes

| Key | What it is | This agent |
|---|---|---|
| `camera-scans/{hub}/{device}/{stamp}.json` | The scan record | `description` and `reviewed_at` only, via `scan-review` |
| `camera-scans/{hub}/{device}/{stamp}.jpg` | The picture | Do not write |
| `property-profile/d9f759d7351db3886c79dd689c41e3c0.json` | Tracy's property profile | The compiled profile, via `property-profile` |
| `safe/` `satellite/` `plane/` `cameras/` `index/` | Other records | Do not write |
| CHEKT | Live video | Do not call |
| Google Sheet | Enrollment | Do not write |

## 4.1 Tracy's property profile

When Jonah's task is Tracy's profile, do only this section, then stop. Do not start the 5-minute `scan-next` loop. Do not call `scan-list` or `scan-frame`. Those need the property password, and you do not have it.

Tracy's house is the Jones residence, SAFE hub `d9f759d7351db3886c79dd689c41e3c0` (site_no 14725). That is the only profile you write. Do not write `6de88883bfd4a8349a901c54611ed9d7` or `2dce25a3643b86a7d8a1551228c3306f`.

`description` says what the cameras usually show, in one paragraph of at most 2000 characters. `who` is `""` on every character. You cannot tell from a picture that a car belongs to the homeowner. `source` is `images`. `zone` is `America/Chicago`. `characters` and `history` are lists. They may be empty.

A character requires the same appearance, place, and time in at least two history rows that you include. One sighting stays in `history` only, with `character_id` `""`. A matching scene is `depth` `light`. A different vehicle, or a known thing outside its place or window, is `depth` `full` and one sentence of at most 280 characters. Do not label anyone a trespasser. `kind` is `vehicle`, `person`, `routine`, or `object`. `id` is a lowercase slug. `when` is `null`, or `{days, start, end}` with days `mon` through `sun` and times `HH:mm`.

Send history rows for frames that have a sentence, and the two supporting rows for each character. Do not send a row for every quiet scan. The script keeps the newest 200 rows. If a character's two rows fall outside those 200, the write fails.

1. Read the profile. `saved: false` means it is not on the bucket yet. That is a normal first read. `records: refused S3 key` means the deployed script does not allow `property-profile/` yet. Stop and tell Jonah. Do not POST.

```text
GET https://script.google.com/macros/s/AKfycbzHkj4fNRBJ7839babxL2Gp1A2ka9Em05rOQRZUNg_X0lMrOAMEKtEXEXxuU9_u7iKERA/exec?route=property-profile&review_key={review_key}&hub=d9f759d7351db3886c79dd689c41e3c0
```

2. List Tracy's cameras. This returns names and the latest sentence. It does not return pictures.

```text
GET https://script.google.com/macros/s/AKfycbzHkj4fNRBJ7839babxL2Gp1A2ka9Em05rOQRZUNg_X0lMrOAMEKtEXEXxuU9_u7iKERA/exec?route=property-profile-sources&review_key={review_key}
```

3. For each `device_id`, read that camera's chain. Follow `older` until it is empty. `start` is the `older` value from the previous page. URL-encode it.

```text
GET https://script.google.com/macros/s/AKfycbzHkj4fNRBJ7839babxL2Gp1A2ka9Em05rOQRZUNg_X0lMrOAMEKtEXEXxuU9_u7iKERA/exec?route=property-profile-sources&review_key={review_key}&device={device_id}&start={older}
```

4. Open a picture only when you need to see it: every frame whose `description` is not empty, the newest frame on each camera, and one older quiet frame on each camera. `key` is that frame's key.

```text
GET https://script.google.com/macros/s/AKfycbzHkj4fNRBJ7839babxL2Gp1A2ka9Em05rOQRZUNg_X0lMrOAMEKtEXEXxuU9_u7iKERA/exec?route=property-profile-frame&review_key={review_key}&key={key}
```

`jpeg_base64` is the picture. The `description` beside it is the sentence already stored. A frame you did not open, and a sentence you did not read, does not go into the profile.

5. Write the whole object in one POST. Content-Type is `text/plain`. Google answers with a redirect. Follow that redirect once, to the Location URL only, and read that JSON. That JSON is the save result, including `error` when the save was refused. Do not send a new request to the `/exec` URL to learn the result. A new GET does not save. If that JSON is not `ok: true` and `saved: true`, read `error`, fix the object, and POST again.

```text
POST https://script.google.com/macros/s/AKfycbzHkj4fNRBJ7839babxL2Gp1A2ka9Em05rOQRZUNg_X0lMrOAMEKtEXEXxuU9_u7iKERA/exec?route=property-profile&review_key={review_key}
Content-Type: text/plain

{"route":"property-profile","review_key":"{review_key}","hub":"d9f759d7351db3886c79dd689c41e3c0","profile":{}}
```

`profile` is the object in `docs/RECORDS_CONTRACT.md`. The script fills `schema`, `hub`, `site_no`, `source`, and `updated_at`. You fill `description`, `characters`, `history`, and `zone`.

6. GET `property-profile` again. `saved: true` means `property-profile/d9f759d7351db3886c79dd689c41e3c0.json` is on the bucket. Stop.

`unknown route` on step 2 or 4 means the deployed web app is older than critique build `v6.8.31`. Stop and tell Jonah. Do not invent a second hub. Do not guess characters from memory.

## 5. Done

A review is done when `scan-review` returns `ok: true` for that `key`, `description` is empty or one observational sentence, and `reviewed_at` is set. The same scene on a later pair comes back with an empty `description`.

Tracy's profile is done when `property-profile` returns `saved: true` for hub `d9f759d7351db3886c79dd689c41e3c0`. That write is the end of the profile task. It does not replace scan reviews, and it does not start the 5-minute loop.

When the task is the standing review job, `pending: false` means you are caught up for the moment. Wait 5 minutes and call `scan-next` again. Do not invent a scan.

## 6. Tracy reviews after the profile is saved

This section starts only after section 4.1 has finished and `property-profile` returns `saved: true`. It does not replace that first compile. Do not open streams yourself. Do not call `live-look` or `live-clip`. Do not read the activity log. Do not call CHEKT. Tracy is a he.

On each Tracy pair from `scan-next`:

1. GET the profile. Hub `d9f759d7351db3886c79dd689c41e3c0`. Use the review key you already have.
2. Look at the new frame and the previous frame.
3. Decide the sentence from the profile, then POST `scan-review`. For a full event the body includes `"depth":"full"` and the sentence. That save tells the live bot and opens the clip before the response returns. Do this before the history write. A light match sends `"depth":"light"`. A quiet frame omits `depth`. Content-Type is `text/plain`. Follow the redirect once, to the Location URL only, and read that JSON. `ok: true` means the review is saved. `told: true` means the live bot has the sentence. `started: true` means that camera is already recording. Retry until `ok: true`. Do not retry a save that already returned `ok: true`.

```text
POST https://script.google.com/macros/s/AKfycbzHkj4fNRBJ7839babxL2Gp1A2ka9Em05rOQRZUNg_X0lMrOAMEKtEXEXxuU9_u7iKERA/exec?route=scan-review&review_key={review_key}
Content-Type: text/plain

{"route":"scan-review","review_key":"{review_key}","key":"camera-scans/d9f759d7351db3886c79dd689c41e3c0/4350156/20261015T180500000Z.json","description":"A person in a light cap and dark jacket walked across the left side of the driveway.","depth":"full"}
```

4. Append a history row only when the sentence is not empty, or a character matched. A quiet frame with an empty sentence and no character match does not change the profile. When a row is warranted, POST the whole profile as in section 4.1 step 5. Read the redirect's Location once, then GET the profile. `saved: true` means that row is kept. If the POST returns `error`, tell Jonah and keep reviewing. Do not retry that profile in a loop, and do not hold up the next pair.
5. Do not wait to ping. The review already told the live bot. A later `patrol-ping` for the same key updates that notice and does not open a second clip. A light match does not tell the live bot. A quiet frame does not tell the live bot.

A character matches when the new frame fits its `appearance`, `where`, and `when` together. An empty `where` matches any camera. `when` is judged in `America/Chicago`. A match is `depth` `light`: `description` is `""`, or one short clause that names the character. No match is `depth` `full`: one sentence, at most 280 characters. A known character outside its place or outside its window is `full`, and the sentence says which part broke. Do not label anyone a trespasser.

The history row uses `at` from `requested_at`, `device_id` and `camera` from the pair, `character_id` of the match or `""`, `depth`, and the same sentence you saved on the scan. One review does not add a character. `who` stays `""`.

If the profile GET returns `saved: false`, write the scan with the section 1 rule and do not POST a profile. If it returns `records: refused S3 key`, stop and tell Jonah.
