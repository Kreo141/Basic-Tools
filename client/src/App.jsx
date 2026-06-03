import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Link, NavLink, useLocation} from "react-router-dom"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faX, faCloud, faRightLong, faTrash, faDownload } from "@fortawesome/free-solid-svg-icons";

import { uploadFileService } from "./services/uploadFileService.js";
import conversionTypes from "./configs/conversionTypes.json";

import "./App.css";

import AudioIcon from "./assets/icons/AudioIcon.svg";
import VideoIcon from "./assets/icons/VideoIcon.svg";
import ImageIcon from "./assets/icons/ImageIcon.svg";
import DocumentIcon from "./assets/icons/DocumentIcon.svg";

const FileIcons = {
  Audio: AudioIcon,
  Video: VideoIcon,
  Image: ImageIcon,
  Document: DocumentIcon
}

// HELPER/s
const getFileExtension = (filename) => {
  if (!filename) return "";
  return filename
    .slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2)
    .toLowerCase();
};

const getSupportedFormatsRaw = (fileType) => {
    const fileSupportedFormatsRaw = conversionTypes.find(
        (item) => item.name === fileType
    ).supportedFormat

    return fileSupportedFormatsRaw
}

const downloadConvertedFile = (UserKey, filename) => {
    const link = document.createElement("a")
    link.href = `${serverLocation}/convert/history/download/${encodeURIComponent(UserKey)}/${encodeURIComponent(filename)}`;

    link.setAttribute("download", "")

    document.body.appendChild(link)
    link.click()

    document.body.removeChild(link)
}

const getSupportedFormats = (fileType) => Object.keys(getSupportedFormatsRaw(fileType))

const serverDev = "http://192.168.100.12:5001";
const serverProd = "http://server:5001";
const serverLocation = true ? serverDev : serverProd;

// ==========================================
// FILE CONVERTER CONTAINER
// ==========================================
function FileConverter({ UserKey }) {
  const [showFileModal, setShowFileModal] = useState(false);
  const [useFileType, setUseFileType] = useState("file");

  return (
    <div className="page file-converter-root">
      <div className="file-converter-wrapper">
        {conversionTypes.map((type) => {
            return (
              <FileTypeSelect
                key={type.name}
                fileType={type.name}
                supportedFormat={getSupportedFormats(type.name)}
                onSelect={(selectedType) => {
                    setUseFileType(selectedType);
                    setShowFileModal(true);
              }}
              />
            );
        })}

        {showFileModal && (
          <ModalController
            UserKey={UserKey}
            useFileType={useFileType}
            onClose={() => setShowFileModal(false)}
          />
        )}
      </div>
    </div>
  );
}

// ==========================================
// FILE TYPE CARD COMPONENT
// ==========================================
function FileTypeSelect({ fileType, supportedFormat, onSelect }) {
  const IconComponent = FileIcons[fileType]

  const visibleFormats = supportedFormat.slice(0, 5).join(", ");
  const hasMore = supportedFormat.length > 5;

  return (
    <div
      className="file-type-select"
      id={fileType}
      onClick={() => onSelect(fileType)}
    >
      <div className="left flex-row-centerx">
        <div className="file-type-logo-container">
          <img 
            className="file-type-logo" 
            src={FileIcons[fileType]} 
            alt={`${fileType} logo`} 
          />
        </div>
      </div>
      <div className="right">
        <h3 className="file-type-select-label">{fileType}</h3>
        <p>
          {visibleFormats}
          {hasMore ? " and more" : ""}
        </p>
      </div>
    </div>
  );
}

// ==========================================
// MODAL STATE CONTROLLER & WORKFLOW
// ==========================================
function ModalController({ UserKey, useFileType, onClose }) {
  const convertKey = useRef(null);
  const converted_filename = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null);
  const [currentFormat, setCurrentFormat] = useState("");

  const [step, setStep] = useState("select");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [convertProgress, setConvertProgress] = useState(0);
  const [isConverting, setIsConverting] = useState(false);
  const [selectedConversionFormat, setSelectedConversionFormat] =
    useState("None");
  const [convertedFileID, setConvertedFileID] = useState(null);
  const [isShowErrorAlert, setIsShowErrorAlert] = useState(false);

  const selectedType = conversionTypes.find(
    (type) => type.name === useFileType,
  );
  let acceptFormats = "";

  acceptFormats = selectedType
    ? Object.keys(
        conversionTypes.find((item) => item.name === useFileType)
          .supportedFormat,
      )
        .map((f) => `.${f}`)
        .join(",")
    : "";


  useEffect(() => {
    if (!isConverting || !convertKey.current) return;

    const intervalId = setInterval(async () => {
      try {
        const req = await fetch(
          `${serverLocation}/convert/progress/${convertKey.current}`,
        );
        const data = await req.json();
        const progressInt = Math.trunc(data.progress);

        setConvertProgress(progressInt);

        if (progressInt >= 100) {
          setIsConverting(false);
        }
      } catch (error) {
        console.error("Polling error:", error);
        setIsConverting(false);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [isConverting]);

  const handleUpload = async (file) => {
    setStep("uploading");
    setCurrentFormat(getFileExtension(file.name));

    try {
      const data = await uploadFileService(file, file.name, (percent) =>
        setUploadProgress(percent),
      );
      convertKey.current = data.convertKey;
      setStep("convert");
    } catch (error) {
      alert(error.message || "Upload failed");
      setStep("select");
    }
  };

  const handleConversion = async () => {
    if (selectedConversionFormat === "None")
      return alert("Please select a target format");
    setIsConverting(true);
    setConvertProgress(0);

    try {
      const req = await fetch(`${serverLocation}/convert/${useFileType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          convertKey: convertKey.current,
          originalFormat: currentFormat,
          toConvertTo: selectedConversionFormat,
          OwnerKey: UserKey
        }),
      });

      if (!req.ok) {
        const errorData = await req.json();
        console.log(errorData.error);
        setIsConverting(false)
        handleError();
        return;
      }

      const data = await req.json();
      converted_filename.current = data.converted_filename;
    } catch (error) {
      console.error("Conversion triggering failed:", error);
      setIsConverting(false);
    }
  };

  function handleError() {
    setIsShowErrorAlert(true);

    setTimeout(() => {
      setIsShowErrorAlert(false);
    }, 2000);
  }
  
  const deleteUploadedFile = () => {
    try{
      fetch(`${serverLocation}/convert/deleteOriginalFile/${convertKey.current}`)
    } catch(error){
      console.error(error)
    }
  }

  return (
    <div className="upload-file-modal-container">
      {step === "select" && (
        <UploadStep
          useFileType={useFileType}
          acceptFormats={acceptFormats}
          onClose={ () => {
            onClose()
          }}
          onFileValidated={(file) => {
            setSelectedFile(file);
            handleUpload(file);
          }}
        />
      )}

      {step === "uploading" && (
        <ProgressStep fileName={selectedFile?.name} progress={uploadProgress} />
      )}
      {step === "convert" && (
        <ConvertStep
          useFileType={useFileType}
          fileName={selectedFile?.name}
          currentFormat={currentFormat}
          supportedFormats={
            selectedType?.supportedFormat || []
          }
          selectedConversionFormat={selectedConversionFormat}
          setSelectedConversionFormat={setSelectedConversionFormat}
          convertProgress={convertProgress}
          convertedFileID={convertedFileID}
          downloadConvertedFile={() => downloadConvertedFile(UserKey, converted_filename.current)}
          isConverting={isConverting}
          onConvert={handleConversion}
          onClose={ () => {
            onClose()
            deleteUploadedFile()
          }}
        />
      )}

      {isShowErrorAlert && (
        <div role="alert" className="alert alert-error">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 shrink-0 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Error! Task failed.</span>
        </div>
      )}
    </div>
  );
}

// ==========================================
// SUB-STEPS
// ==========================================

function UploadStep({ useFileType, acceptFormats, onClose, onFileValidated }) {
  const inputFileRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const verifyAndProcessFile = (file) => {
    if (!file) return;
    const matches = acceptFormats
      .split(",")
      .some((format) => file.name.toLowerCase().endsWith(format.trim()));
    if (matches) {
      onFileValidated(file);
    } else {
      alert("This file is not supported or wrong file type");
    }
  };

  return (
    <div className={`upload-file-modal ${isDragging ? "dragging" : ""}`}>
      <input
        ref={inputFileRef}
        type="file"
        accept={acceptFormats}
        hidden
        onChange={(e) => verifyAndProcessFile(e.target.files[0])}
      />

      <div className="modal-head flex-column-centery">
        <p className="upload-modal-head-label">Upload File</p>
        <p className="upload-modal-head-description">
          Select or upload {useFileType}
        </p>
        <FontAwesomeIcon
          icon={faX}
          className="upload-modal-close"
          onClick={onClose}
        />
      </div>

      <div
        className="main"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          verifyAndProcessFile(e.dataTransfer.files[0]);
        }}
      >
        <FontAwesomeIcon icon={faCloud} className="upload-modal-cloud-icon" />
        <p>Choose a file or drag & drop it here</p>
        <button
          className="browse-file-btn"
          onClick={() => inputFileRef.current.click()}
        >
          Browse file
        </button>
      </div>
    </div>
  );
}

function ProgressStep({ fileName, progress }) {
  return (
    <div className="uploading-modal">
      <h2 className="uploading-modal-header">Uploading {fileName}</h2>
      <div className="progress-container">
        <p>{progress}%</p>
        <progress
          className="progress progress-primary w-56"
          value={progress}
          max="100"
        />
      </div>
    </div>
  );
}

function ConvertStep({
  useFileType,
  fileName,
  currentFormat,
  supportedFormats,
  selectedConversionFormat,
  setSelectedConversionFormat,
  convertProgress,
  convertedFileID,
  downloadConvertedFile,
  isConverting,
  onConvert,
  onClose,
}) {
  return (
    <div className="convert-modal">
      <div className="convert-modal-head">
        <h3>Select format to convert</h3>
        <FontAwesomeIcon
          icon={faX}
          className="convert-modal-close"
          onClick={onClose}
        />
      </div>

      <div className="convert-modal-main">
        <h1>{fileName}</h1>
        <div className="convert-modal-format">
          <p className="file-format-badge original-format">{currentFormat}</p>
          <FontAwesomeIcon icon={faRightLong} />

          <div className="dropdown dropdown-hover">
            <div tabIndex={0} role="button" className="btn m-1">
              {selectedConversionFormat}
            </div>
            <ul
              tabIndex={-1}
              className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm"
            >
              {
                getSupportedFormatsRaw(useFileType)[currentFormat].map((format) => {
                  return (
                    <li
                      key={format}
                      onClick={() => setSelectedConversionFormat(format)}
                    >
                      <a>{format}</a>
                    </li>
                  );
                })}
            </ul>
          </div>
        </div>
        <progress
          className="progress progress-error w-56"
          value={convertProgress}
          max="100"
        />
        <button
          className={`convert-btn ${isConverting ? "disable-btn" : ""}`}
          disabled={isConverting}
          onClick={onConvert}
        >
          {isConverting ? "Converting..." : "Convert"}
        </button>

        {convertProgress == 100 && !isConverting && (
          <button
            className={`download-btn ${convertProgress == 100 ? "" : "disable-btn"}`}
            onClick={() => downloadConvertedFile()}
          >
            Download
          </button>
        )}
      </div>
    </div>
  );
}

// ==========================================
// HISTORY CONTAINER
// ==========================================

function ConvertHistory({UserKey}){
  const [loading, setLoading] = useState(true)
  const [converts, setConverts] = useState({})
  
  useEffect(() => {
    async function fetchConverts() {
      try{
        setLoading(true)

        const response = await fetch(`${serverLocation}/convert/history/${UserKey}`)

        if(!response.ok){
          console.error(`HTTP error! Status: ${response.status}`)
          throw new Error(`HTTP error! Status: ${response.status}`)
        }

        const data = await response.json()

        setConverts(data.converts)
        setLoading(false)
      } catch(error){
        setLoading(false)
      }
    }

    fetchConverts()
  }, [])

  return(
    <div className="page history-container">
      {loading ? (
        <span className="loading loading-spinner text-neutral"></span>
      ) : Object.keys(converts).length === 0 ? (
        <h1>No convert history</h1>
      ) : (
        Object.keys(converts).map(item => (
          <div className="convert-item" key={item}>
            <div className="convert-item-info">
              <h1 className="converted-filename">{item}</h1>
              <p>
                Expires on{" "}
                <span style={{ fontWeight: "bold" }}>
                  {converts[item].age}
                </span>
              </p>
            </div>

            <div className="convert-item-operation">
              <FontAwesomeIcon
                className="Delete converted-delete-btn"
                icon={faTrash}
              />

              <FontAwesomeIcon
                className="Download converted-download-btn"
                icon={faDownload}
                onClick={() =>
                  downloadConvertedFile(converts[item].OwnerKey, item)
                }
              />
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function AppContent({ UserKey }) {
  const location = useLocation();

  return (
    <>
      <div className="nav">
        <div className="nav-inner">
          <div className="logo-container">
            <img className="logo-icon" alt="logo" />
            <Link className="logo-label" to="/">Converthings</Link>
          </div>
        </div>

        <Link to={location.pathname !== "/history" ? "/history" : "/"}>
          <button className="history-btn">
            {location.pathname !== "/history" ? "History" : "Home"}
          </button>
        </Link>
      </div>

      <Routes>
        <Route path="/" element={<FileConverter UserKey={UserKey} />} />
        <Route path="/history" element={<ConvertHistory UserKey={UserKey} />} />
        <Route path="*" element={<FileConverter UserKey={UserKey} />} />
      </Routes>
    </>
  );
}

function App() {
  const generateUUID = () => {
    if (crypto?.randomUUID) {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  };

  const UserKey =
    localStorage.getItem("UserKey") ??
    (() => {
      const id = generateUUID();
      localStorage.setItem("UserKey", id);
      return id;
    })();

  return (
    <BrowserRouter>
      <AppContent UserKey={UserKey} />
    </BrowserRouter>
  );
}

export default App;
