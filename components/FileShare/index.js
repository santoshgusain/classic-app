import React, { useState, useEffect, useRef } from "react";
import shortid from "shortid";
import io from "socket.io-client";
import { useSearchParams } from "next/navigation";
import QRCode from "react-qr-code";
import CopyToClipboard from "react-copy-to-clipboard";

async function readStreams(stream, result = []) {
  const { done, value } = await stream.read();
  if (done) {
    return result;
  }
  result.push(value);
  return readStreams(stream, result);
}

export default function FileShare() {
  const shareableFileRef = useRef();
  const roomNameRef = useRef();
  const queryParameters = useSearchParams();
  let downloadableFile = [];
  const [selectedfile, SetSelectedFile] = useState([]);
  const [shareableURL, setShareableURL] = useState("");
  const [Files, SetFiles] = useState([]);
  const [socket, setSocket] = useState(null);
  const [progress, setProgress] = useState(0);

  // Initializing Socket
  useEffect(() => {
    const roomId = queryParameters.get("r");
    if (!socket) {
      initSocket();
    } else {
      if (roomId) {
        roomNameRef.current = roomId;
        socket.emit("join-room", roomId);
      }
    }
    console.log(roomId, "===========");
  }, [socket, queryParameters]);

  /**
   * Initializing socket
   * Handling socket events
   */
  const initSocket = async () => {
    // initialize Socket-io server
    await fetch("/api/socket");
    let socket = io();

    socket.on("disconnect", (reason, details) => {
      console.log("Disconnected");
      // the reason of the disconnection, for example "transport error"
      console.log(reason);

      // the low-level reason of the disconnection, for example "xhr post error"
      console.log(details.message);

      // some additional description, for example the status code of the HTTP response
      console.log(details.description);

      // some additional context, for example the XMLHttpRequest object
      console.log(details.context);
    });

    setSocket(socket);

    socket.on("connect_error", (err) => {
      // the reason of the error, for example "xhr poll error"
      console.log(err.message);

      // some additional description, for example the status code of the initial HTTP response
      console.log(err.description);

      // some additional context, for example the XMLHttpRequest object
      console.log(err.context);
    });

    socket.on("transfer-data", async (data) => {
      console.log("transfer-data-started......", data);
      const { roomName } = data;
      let file = shareableFileRef.current;
      let fileName = file.name;
      let stream = file.stream();
      stream = stream.getReader();
      // tranfer data to user
      const chunks = await readStreams(stream);
      const totalChunks = chunks?.length;
      // packetsSize = totalChunks;
      let count = 0;
      for (let chunk of chunks) {
        console.log(++count, chunks.length);
        socket.emit("upload", { chunk, totalChunks, roomName });
      }
      socket.emit("upload", { fileName, roomName });
    });

    /**
     * @description code for handling file download
     */
    socket.on("download", async (data) => {
      let { fileName: filename, chunk: file, totalChunks } = data;

      if (file) {
        downloadableFile.push(file);
        let currentChunks = parseInt(downloadableFile?.length);
        totalChunks = parseInt(totalChunks);
        let progress = (currentChunks / totalChunks) * 100;
        progress = progress.toFixed(2);
        setProgress(() => progress);
        if (progress && roomNameRef.current)
          socket.emit("progress-done", {
            progress,
            roomName: roomNameRef.current,
          });
        return true;
      }

      // code for combining all the chunks into one
      let totalSize = downloadableFile.reduce(
        (acc, buffer) => acc + buffer.byteLength,
        0
      );
      // Create a new ArrayBuffer with the total size
      let concatenatedBuffer = new ArrayBuffer(totalSize);

      // Use a DataView to copy the contents of each buffer into the new buffer
      let dataView = new DataView(concatenatedBuffer);
      let offset = 0;

      for (let buffer of downloadableFile) {
        let sourceView = new DataView(buffer);
        for (let i = 0; i < buffer.byteLength; i++) {
          dataView.setUint8(offset + i, sourceView.getUint8(i));
        }
        offset += buffer.byteLength;
      }

      // code for downloading file
      const blob = new Blob([concatenatedBuffer], {
        type: "application/octet-stream",
      });
      // const blob = new Blob([bufferData], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      downloadableFile = [];
    });

    socket.on("download-progress", async (progress) => {
      setProgress(() => progress);
      // socket.emit("progress-done", progress);
    });
  };

  const filesizes = (bytes, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const InputChange = (e) => {
    const roomName = shortid.generate();
    socket.emit("join-room", roomName);
    const url = `${window.location.origin}/share?r=${roomName}`;
    setShareableURL(() => url);
    shareableFileRef.current = e.target.files[0];
    // --For Multiple File Input
    let images = [];
    for (let i = 0; i < e.target.files.length; i++) {
      images.push(e.target.files[i]);
      let reader = new FileReader();
      let file = e.target.files[i];
      reader.onloadend = () => {
        SetSelectedFile(() => {
          return [
            {
              id: shortid.generate(),
              filename: e.target.files[i].name,
              filetype: e.target.files[i].type,
              fileimage: reader.result,
              datetime:
                e.target.files[i].lastModifiedDate.toLocaleString("en-IN"),
              filesize: filesizes(e.target.files[i].size),
            },
          ];
        });
      };
      if (e.target.files[i]) {
        reader.readAsDataURL(file);
      }
    }
  };

  const DeleteSelectFile = (id) => {
    if (window.confirm("Are you sure you want to delete this Image?")) {
      const result = selectedfile.filter((data) => data.id !== id);
      SetSelectedFile(result);
    } else {
      // alert('No');
    }
  };

  const FileUploadSubmit = async (e) => {
    e.preventDefault();

    // form reset on submit
    e.target.reset();
    if (selectedfile.length > 0) {
      for (let index = 0; index < selectedfile.length; index++) {
        SetFiles((preValue) => {
          return [selectedfile[index]];
        });
      }
      SetSelectedFile([]);
    } else {
      alert("Please select file");
    }
  };

  const DeleteFile = async (id) => {
    if (window.confirm("Are you sure you want to delete this Image?")) {
      const result = Files.filter((data) => data.id !== id);
      SetFiles(result);
    } else {
      // alert('No');
    }
  };

  return (
    <>
      {queryParameters.get("r") ? (
        <>
          <div>File downloading start: {queryParameters.get("r")}</div>
          <h4>Transfered: {progress}</h4>
        </>
      ) : (
        <div className="fileupload-view">
          <div className="row justify-content-center m-0">
            <div className="col-md-6">
              <div className="card mt-5">
                <div className="card-body">
                  <div className="kb-data-box">
                    <form onSubmit={FileUploadSubmit}>
                      <div className="kb-file-upload">
                        <div className="file-upload-box">
                          <input
                            type="file"
                            id="fileupload"
                            className="file-upload-input"
                            onChange={InputChange}
                          />
                          <span>
                            Drag and drop or{" "}
                            <span className="file-link">Choose your files</span>
                          </span>
                        </div>
                      </div>
                      <div className="kb-attach-box mb-3">
                        {selectedfile.map((data, index) => {
                          const {
                            id,
                            filename,
                            filetype,
                            fileimage,
                            datetime,
                            filesize,
                          } = data;
                          return (
                            <div className="file-atc-box" key={id}>
                              {filename.match(/.(jpg|jpeg|png|gif|svg)$/i) ? (
                                <div className="file-image">
                                  {" "}
                                  <img src={fileimage} alt="" />
                                </div>
                              ) : (
                                <div className="file-image">
                                  <i className="far fa-file-alt"></i>
                                </div>
                              )}
                              <div className="file-detail">
                                <h6>{filename}</h6>
                                <p></p>
                                <p>
                                  <span>Size : {filesize}</span>
                                  <span className="ml-2">
                                    Modified Time : {datetime}
                                  </span>
                                </p>
                                <div className="file-actions">
                                  <button
                                    type="button"
                                    className="file-action-btn"
                                    onClick={() => DeleteSelectFile(id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="kb-buttons-box">
                        <div
                          style={{
                            height: "auto",
                            margin: "0 auto",
                            maxWidth: "100%",
                            width: "100%",
                            textAlign: "center",
                          }}
                        >
                          {shareableURL && (
                            <>
                              <QRCode
                                // size={156}
                                style={{
                                  height: "auto",
                                  maxWidth: "100%",
                                  width: 250,
                                }}
                                value={shareableURL}
                                // viewBox={`0 0 356 356`}
                              />
                              <div style={{ margin: "2rem 0" }}>
                                <p>{shareableURL}</p>
                                <CopyToClipboard text={shareableURL}>
                                  <button type="button">Copy</button>
                                </CopyToClipboard>
                              </div>
                              <div>
                                <strong>Transfered: </strong>
                                {progress}%
                              </div>
                            </>
                          )}
                        </div>
                        {/* <button
                          type="submit"
                          className="btn btn-primary form-submit"
                        >
                          Upload
                        </button> */}
                      </div>
                    </form>
                    {Files.length > 0 ? (
                      <div className="kb-attach-box">
                        <hr />
                        {Files.map((data, index) => {
                          const {
                            id,
                            filename,
                            filetype,
                            fileimage,
                            datetime,
                            filesize,
                          } = data;
                          return (
                            <div className="file-atc-box" key={index}>
                              {filename.match(/.(jpg|jpeg|png|gif|svg)$/i) ? (
                                <div className="file-image">
                                  {" "}
                                  <img src={fileimage} alt="" />
                                </div>
                              ) : (
                                <div className="file-image">
                                  <i className="far fa-file-alt"></i>
                                </div>
                              )}
                              <div className="file-detail">
                                <h6>{filename}</h6>
                                <p>
                                  <span>Size : {filesize}</span>
                                  <span className="ml-3">
                                    Modified Time : {datetime}
                                  </span>
                                </p>
                                <div className="file-actions">
                                  <button
                                    className="file-action-btn"
                                    onClick={() => DeleteFile(id)}
                                  >
                                    Delete
                                  </button>
                                  <a
                                    href={fileimage}
                                    className="file-action-btn"
                                    download={filename}
                                  >
                                    Download
                                  </a>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      ""
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
