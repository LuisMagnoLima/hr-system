(function () {
  "use strict";

  const instances = [];
  let dragDepth = 0;

  function formatSize(bytes) {
    if (!Number.isFinite(bytes)) return "";
    const mb = bytes / 1024 / 1024;
    return mb >= 1 ? mb.toFixed(2) + " MB" : Math.max(1, Math.round(bytes / 1024)) + " KB";
  }

  function isPdf(file) {
    if (!file) return false;
    return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  }

  function hasFiles(event) {
    const types = event.dataTransfer && event.dataTransfer.types;
    return Boolean(types && Array.from(types).includes("Files"));
  }

  function setInputFile(input, file) {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function isVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
  }

  function activeInstance() {
    return instances.find(function (item) {
      return isVisible(item.modal);
    }) || null;
  }

  function setDragging(instance, active) {
    if (!instance) return;
    instance.zone.classList.toggle("is-dragover", active);
    instance.modal.classList.toggle("pdf-global-dragover", active);
  }

  function clearDragging() {
    instances.forEach(function (item) {
      setDragging(item, false);
    });
    dragDepth = 0;
  }

  function setup(zone) {
    const input = zone.querySelector('input[type="file"]');
    if (!input) return;

    const modal = zone.closest(".ger-modal, .financeiro-modal") ||
      zone.closest(".ger-modal-content, .financeiro-modal-content") || zone;
    const nameEl = zone.querySelector(".pdf-dropzone-file-name");
    const sizeEl = zone.querySelector(".pdf-dropzone-file-size");
    const removeBtn = zone.querySelector(".pdf-dropzone-remove");

    const instance = { zone: zone, input: input, modal: modal, receive: receive };
    instances.push(instance);

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

  // Captura o PDF em qualquer ponto da tela enquanto um modal de upload estiver aberto.
  document.addEventListener("dragenter", function (event) {
    const instance = activeInstance();
    if (!instance || !hasFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
    setDragging(instance, true);
  });

  document.addEventListener("dragover", function (event) {
    const instance = activeInstance();
    if (!instance || !hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    setDragging(instance, true);
  });

  document.addEventListener("dragleave", function (event) {
    const instance = activeInstance();
    if (!instance || !hasFiles(event)) return;
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) clearDragging();
  });

  document.addEventListener("drop", function (event) {
    const instance = activeInstance();
    if (!instance || !hasFiles(event)) return;

    // Evita que Edge/Chrome abra o PDF ao soltar fora da caixa.
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer && event.dataTransfer.files;
    clearDragging();
    if (files && files.length) instance.receive(files[0]);
  });

  window.addEventListener("dragend", clearDragging);
  window.addEventListener("blur", clearDragging);

  function init() {
    document.querySelectorAll(".pdf-dropzone").forEach(setup);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
