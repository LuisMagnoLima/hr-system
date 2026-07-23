(function () {
  "use strict";

  function formatSize(bytes) {
    if (!Number.isFinite(bytes)) return "";
    const mb = bytes / 1024 / 1024;
    return mb >= 1 ? mb.toFixed(2) + " MB" : Math.max(1, Math.round(bytes / 1024)) + " KB";
  }

  function isPdf(file) {
    if (!file) return false;
    return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  }

  function setInputFile(input, file) {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setup(zone) {
    const input = zone.querySelector('input[type="file"]');
    if (!input) return;

    const modal = zone.closest(".ger-modal-content, .financeiro-modal-content") || zone;
    const nameEl = zone.querySelector(".pdf-dropzone-file-name");
    const sizeEl = zone.querySelector(".pdf-dropzone-file-size");
    const removeBtn = zone.querySelector(".pdf-dropzone-remove");

    function showFile(file) {
      zone.classList.remove("is-invalid");
      zone.classList.toggle("has-file", Boolean(file));
      if (nameEl) nameEl.textContent = file ? file.name : "";
      if (sizeEl) sizeEl.textContent = file ? formatSize(file.size) : "";
    }

    function receive(file) {
      if (!isPdf(file)) {
        zone.classList.add("is-invalid");
        alert("Selecione somente arquivos PDF.");
        return;
      }
      setInputFile(input, file);
      showFile(file);
    }

    [zone, modal].forEach(function (target) {
      target.addEventListener("dragenter", function (event) {
        event.preventDefault();
        event.stopPropagation();
        zone.classList.add("is-dragover");
      });

      target.addEventListener("dragover", function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        zone.classList.add("is-dragover");
      });

      target.addEventListener("dragleave", function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (!modal.contains(event.relatedTarget)) zone.classList.remove("is-dragover");
      });

      target.addEventListener("drop", function (event) {
        event.preventDefault();
        event.stopPropagation();
        zone.classList.remove("is-dragover");
        const files = event.dataTransfer && event.dataTransfer.files;
        if (files && files.length) receive(files[0]);
      });
    });

    zone.addEventListener("click", function (event) {
      if (event.target.closest(".pdf-dropzone-remove")) return;
      input.click();
    });

    input.addEventListener("change", function () {
      const file = input.files && input.files[0];
      if (file && !isPdf(file)) {
        input.value = "";
        showFile(null);
        zone.classList.add("is-invalid");
        alert("Selecione somente arquivos PDF.");
        return;
      }
      showFile(file || null);
    });

    if (removeBtn) {
      removeBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        input.value = "";
        showFile(null);
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
  }

  function init() {
    document.querySelectorAll(".pdf-dropzone").forEach(setup);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
