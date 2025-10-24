interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
}

interface FileRecord {
  id: string;
  filename: string;
  size: number;
  mime_type: string;
  r2_key: string;
  uploaded_at: number;
  download_count: number;
}

const MAX_TOTAL_STORAGE = 5 * 1024 * 1024 * 1024;
const MAX_FILE_SIZE = 100 * 1024 * 1024;

async function getTotalStorageUsed(env: Env): Promise<number> {
  const result = await env.DB.prepare(
    "SELECT COALESCE(SUM(size), 0) as total FROM files"
  ).first<{ total: number }>();
  return result?.total || 0;
}

function validateFileSize(size: number): { valid: boolean; error?: string } {
  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: `File exceeds 100MB limit` };
  }
  return { valid: true };
}

async function canUpload(
  env: Env,
  fileSize: number
): Promise<{ ok: boolean; error?: string }> {
  const sizeCheck = validateFileSize(fileSize);
  if (!sizeCheck.valid) {
    return { ok: false, error: sizeCheck.error };
  }

  const totalUsed = await getTotalStorageUsed(env);
  if (totalUsed + fileSize > MAX_TOTAL_STORAGE) {
    return { ok: false, error: `Storage limit exceeded (5GB max)` };
  }

  return { ok: true };
}

function generateId(): string {
  return crypto.randomUUID();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/upload" && request.method === "POST") {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
          return Response.json({ error: "No file provided" }, { status: 400 });
        }

        const uploadCheck = await canUpload(env, file.size);
        if (!uploadCheck.ok) {
          return Response.json({ error: uploadCheck.error }, { status: 413 });
        }

        const id = generateId();
        const r2Key = `${id}/${file.name}`;

        await env.BUCKET.put(r2Key, file.stream(), {
          httpMetadata: {
            contentType: file.type,
          },
        });

        await env.DB.prepare(
          "INSERT INTO files (id, filename, size, mime_type, r2_key, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
          .bind(id, file.name, file.size, file.type, r2Key, Date.now())
          .run();

        return Response.json({
          id,
          filename: file.name,
          size: file.size,
          downloadUrl: `/api/files/${id}`,
        });
      }

      if (url.pathname.startsWith("/api/files/") && request.method === "GET") {
        const id = url.pathname.split("/")[3];

        const fileRecord = await env.DB.prepare(
          "SELECT * FROM files WHERE id = ?"
        )
          .bind(id)
          .first<FileRecord>();

        if (!fileRecord) {
          return Response.json({ error: "File not found" }, { status: 404 });
        }

        const object = await env.BUCKET.get(fileRecord.r2_key);
        if (!object) {
          return Response.json(
            { error: "File not found in storage" },
            { status: 404 }
          );
        }

        await env.DB.prepare(
          "UPDATE files SET download_count = download_count + 1 WHERE id = ?"
        )
          .bind(id)
          .run();

        return new Response(object.body, {
          headers: {
            "Content-Type": fileRecord.mime_type,
            "Content-Disposition": `attachment; filename="${fileRecord.filename}"`,
          },
        });
      }

      if (url.pathname === "/api/files" && request.method === "GET") {
        const files = await env.DB.prepare(
          "SELECT * FROM files ORDER BY uploaded_at DESC"
        ).all<FileRecord>();

        const totalUsed = await getTotalStorageUsed(env);

        return Response.json({
          files: files.results,
          totalStorageUsed: totalUsed,
          totalStorageLimit: 5 * 1024 * 1024 * 1024,
        });
      }

      if (
        url.pathname.startsWith("/api/files/") &&
        request.method === "DELETE"
      ) {
        const id = url.pathname.split("/")[3];

        const fileRecord = await env.DB.prepare(
          "SELECT * FROM files WHERE id = ?"
        )
          .bind(id)
          .first<FileRecord>();

        if (!fileRecord) {
          return Response.json({ error: "File not found" }, { status: 404 });
        }

        await env.BUCKET.delete(fileRecord.r2_key);
        await env.DB.prepare("DELETE FROM files WHERE id = ?").bind(id).run();

        return Response.json({ success: true });
      }

      return new Response(null, { status: 404 });
    } catch (error) {
      console.error(error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
