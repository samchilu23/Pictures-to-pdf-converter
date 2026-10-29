
const imageInput = document.getElementById("imageInput");
const preview = document.getElementById("preview");
const imageCount = document.getElementById("imageCount");
const convertBtn = document.getElementById("convertBtn");
const clearBtn = document.getElementById("clearBtn");
const statusText = document.getElementById("status");

let pictures = [];
let busy = false;

imageInput.addEventListener("change", () => {
  const files = Array.from(imageInput.files || []);
  let rejected = 0;

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      rejected++;
      continue;
    }

    pictures.push({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file)
    });
  }

  imageInput.value = "";
  renderPictures();

  statusText.textContent = rejected
    ? `${rejected} unsupported file(s) skipped.`
    : "";
});

function renderPictures() {
  preview.replaceChildren();

  if (pictures.length === 0) {
    preview.innerHTML = `
      <div class="empty">
        <div class="empty-icon">🖼️</div>
        <p>No pictures selected yet.</p>
        <small>Your selected pictures will appear here.</small>
      </div>`;
  }

  pictures.forEach((picture, index) => {
    const card = document.createElement("div");
    card.className = "photo-card";

    const img = document.createElement("img");
    img.src = picture.url;
    img.alt = "Picture " + (index + 1);

    const name = document.createElement("p");
    name.className = "photo-name";
    name.textContent = `${index + 1}. ${picture.file.name}`;

    const actions = document.createElement("div");
    actions.className = "photo-actions";

    const up = document.createElement("button");
    up.textContent = "↑";
    up.title = "Move up";
    up.setAttribute("aria-label", "Move picture up");
    up.disabled = busy || index === 0;
    up.onclick = () => movePicture(index, -1);

    const down = document.createElement("button");
    down.textContent = "↓";
    down.title = "Move down";
    down.setAttribute("aria-label", "Move picture down");
    down.disabled = busy || index === pictures.length - 1;
    down.onclick = () => movePicture(index, 1);

    const remove = document.createElement("button");
    remove.textContent = "Remove";
    remove.className = "remove";
    remove.disabled = busy;
    remove.onclick = () => removePicture(picture.id);

    actions.append(up, down, remove);
    card.append(img, name, actions);
    preview.appendChild(card);
  });

  imageCount.textContent =
    `${pictures.length} picture${pictures.length === 1 ? "" : "s"}`;

  convertBtn.disabled = busy || pictures.length === 0;
  clearBtn.disabled = busy || pictures.length === 0;
  imageInput.disabled = busy;
  document.querySelectorAll(".settings select").forEach(el => {
    el.disabled = busy;
  });
}

function movePicture(index, direction) {
  const newIndex = index + direction;

  if (newIndex < 0 || newIndex >= pictures.length || busy) {
    return;
  }

  [pictures[index], pictures[newIndex]] =
    [pictures[newIndex], pictures[index]];

  renderPictures();
}

function removePicture(id) {
  if (busy) return;

  const index = pictures.findIndex(p => p.id === id);

  if (index !== -1) {
    URL.revokeObjectURL(pictures[index].url);
    pictures.splice(index, 1);
    renderPictures();
  }
}

clearBtn.addEventListener("click", () => {
  if (busy) return;

  pictures.forEach(p => URL.revokeObjectURL(p.url));
  pictures = [];
  statusText.textContent = "";
  renderPictures();
});

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = () => reject(
      new Error("Could not read one of the selected pictures.")
    );

    img.src = url;
  });
}

function imageToJpeg(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Your browser cannot process this picture.");
  }

  // White background prevents transparent areas turning black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  const data = canvas.toDataURL("image/jpeg", 0.92);

  canvas.width = 0;
  canvas.height = 0;

  return data;
}

convertBtn.addEventListener("click", async () => {
  if (busy || pictures.length === 0) return;

  if (!window.jspdf || !window.jspdf.jsPDF) {
    statusText.textContent =
      "PDF library unavailable. Check your internet connection and reload.";
    return;
  }

  busy = true;
  renderPictures();
  statusText.textContent = "Preparing your PDF...";

  try {
    const { jsPDF } = window.jspdf;

    const doc = new jsPDF({
      orientation: document.getElementById("orientation").value,
      unit: "mm",
      format: document.getElementById("paperSize").value,
      compress: true
    });

    const margin = Number(
      document.getElementById("margin").value
    );

    for (let i = 0; i < pictures.length; i++) {
      statusText.textContent =
        `Converting picture ${i + 1} of ${pictures.length}...`;

      const img = await loadImage(pictures[i].url);
      const imageData = imageToJpeg(img);

      if (i > 0) {
        doc.addPage();
      }

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - margin * 2;

      if (availableWidth <= 0 || availableHeight <= 0) {
        throw new Error("The selected margin is too large.");
      }

      // Fit each picture inside the page without distortion.
      const scale = Math.min(
        availableWidth / img.naturalWidth,
        availableHeight / img.naturalHeight
      );

      const width = img.naturalWidth * scale;
      const height = img.naturalHeight * scale;

      const x = (pageWidth - width) / 2;
      const y = (pageHeight - height) / 2;

      doc.addImage(
        imageData,
        "JPEG",
        x,
        y,
        width,
        height,
        undefined,
        "FAST"
      );
    }

    doc.save("pictures-to-pdf.pdf");
    statusText.textContent =
      "PDF created! Check your Downloads folder.";
  } catch (error) {
    console.error(error);
    statusText.textContent =
      error.message || "Something went wrong. Please try again.";
  } finally {
    busy = false;
    renderPictures();
  }
});

renderPictures();


