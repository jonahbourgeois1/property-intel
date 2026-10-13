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

`pending: false` means every stored frame has been handled. Stop.

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

```text
POST https://script.google.com/macros/s/AKfycbzHkj4fNRBJ7839babxL2Gp1A2ka9Em05rOQRZUNg_X0lMrOAMEKtEXEXxuU9_u7iKERA/exec?route=scan-review
Content-Type: text/plain

{"route":"scan-review","review_key":"{review_key}","key":"camera-scans/{hub}/{device}/{stamp}.json","description":""}
```

Use `text/plain`. `application/json` triggers a preflight the web app cannot answer.

`key` is the `key` from `scan-next`. `description` is `""` or one sentence, at most 280 characters. The script sets `reviewed_at`. You do not send a time.

Then call `scan-next` again. Keep going through `indexing: true` responses until a response has `pending: false`.

## 4. Allowed writes

| Key | What it is | This agent |
|---|---|---|
| `camera-scans/{hub}/{device}/{stamp}.json` | The scan record | `description` and `reviewed_at` only, via `scan-review` |
| `camera-scans/{hub}/{device}/{stamp}.jpg` | The picture | Do not write |
| `safe/` `satellite/` `plane/` `cameras/` `index/` | Other records | Do not write |
| CHEKT | Live video | Do not call |
| Google Sheet | Enrollment | Do not write |

## 5. Done

A review is done when `scan-review` returns `ok: true` for that `key`, `description` is empty or one observational sentence, and `reviewed_at` is set. The same scene on a later pair comes back with an empty `description`.

`pending: false` means you are caught up. Do not invent a scan.
