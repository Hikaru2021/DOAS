import { useEffect } from "react";
import "../CSS/ApplicationModal.css";

export default function ApplicationModal({ application, onClose }) {
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="modal-container" style={{ borderRadius: '12px' }} onClick={onClose}>
      {/* Backdrop */}
      <div className="modal-backdrop"></div>

      {/* Modal */}
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{application.title}</h2>
        <p className="modal-content">{application.description}</p>
        <button onClick={onClose} className="modal-close-btn">
          Close
        </button>
      </div>
    </div>
  );
}
