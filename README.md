# Document sharing service using Cloudflare Workers

Minimal repo with no libraries.

Live URL: https://document-serving.mert-e13.workers.dev

What I learned?

- How to initiate an R2 bucket
- How to upload files to R2 using `BUCKET.put()` with streams
- How to download files from R2 using `BUCKET.get()`
- How to delete files from R2 using `BUCKET.delete()`
- How to set HTTP metadata on R2 objects for proper Content-Type
- How to implement client-side file size validation before upload
- How to implement server-side storage quota checks
- How to track file metadata in D1 while storing actual files in R2
- How to handle multipart form data in Workers
