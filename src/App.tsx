import { useState, useEffect } from "react";
import "./App.css";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

interface FileRecord {
  id: string;
  filename: string;
  size: number;
  mime_type: string;
  uploaded_at: number;
  download_count: number;
}

interface FilesResponse {
  files: FileRecord[];
  totalStorageUsed: number;
  totalStorageLimit: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function App() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [totalUsed, setTotalUsed] = useState(0);
  const [totalLimit, setTotalLimit] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [error, setError] = useState("");

  const loadFiles = async () => {
    try {
      const res = await fetch("/api/files");
      const data: FilesResponse = await res.json();
      setFiles(data.files);
      setTotalUsed(data.totalStorageUsed);
      setTotalLimit(data.totalStorageLimit);
    } catch (err) {
      console.error("Failed to load files:", err);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation before upload
    if (file.size > MAX_FILE_SIZE) {
      setError(`File exceeds 100MB limit (${formatBytes(file.size)})`);
      e.target.value = "";
      return;
    }

    setError("");
    setUploadedUrl("");
    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setUploadProgress((e.loaded / e.total) * 100);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          setUploadedUrl(`${window.location.origin}${data.downloadUrl}`);
          loadFiles();
        } else {
          const data = JSON.parse(xhr.responseText);
          setError(data.error || "Upload failed");
        }
        setUploading(false);
      });

      xhr.addEventListener("error", () => {
        setError("Upload failed");
        setUploading(false);
      });

      xhr.open("POST", "/api/upload");
      xhr.send(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }

    e.target.value = "";
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this file?")) return;

    try {
      await fetch(`/api/files/${id}`, { method: "DELETE" });
      loadFiles();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const usagePercent = (totalUsed / totalLimit) * 100;

  return (
    <div className="container">
      <h1>Document Sharing</h1>

      <div className="storage-info">
        <div className="storage-bar">
          <div className="storage-used" style={{ width: `${usagePercent}%` }} />
        </div>
        <p>
          {formatBytes(totalUsed)} / {formatBytes(totalLimit)} used ({usagePercent.toFixed(1)}%)
        </p>
      </div>

      <div className="upload-section">
        <label className="upload-btn">
          <input type="file" onChange={handleUpload} disabled={uploading} />
          {uploading ? "Uploading..." : "Choose File to Upload"}
        </label>

        {uploading && (
          <div className="progress-bar">
            <div className="progress" style={{ width: `${uploadProgress}%` }} />
          </div>
        )}

        {error && <div className="error">{error}</div>}

        {uploadedUrl && (
          <div className="success">
            <p>File uploaded successfully!</p>
            <div className="url-box">
              <input type="text" value={uploadedUrl} readOnly />
              <button onClick={() => copyToClipboard(uploadedUrl)}>Copy</button>
            </div>
          </div>
        )}
      </div>

      <div className="files-section">
        <h2>Files ({files.length})</h2>
        {files.length === 0 ? (
          <p className="empty">No files uploaded yet</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Filename</th>
                <th>Size</th>
                <th>Downloads</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id}>
                  <td>{file.filename}</td>
                  <td>{formatBytes(file.size)}</td>
                  <td>{file.download_count}</td>
                  <td>{formatDate(file.uploaded_at)}</td>
                  <td>
                    <a href={`/api/files/${file.id}`} className="btn-download">
                      Download
                    </a>
                    <button onClick={() => handleDelete(file.id)} className="btn-delete">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default App;
