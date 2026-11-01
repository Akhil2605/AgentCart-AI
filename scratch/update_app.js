const fs = require('fs');
let app = fs.readFileSync('frontend/app.js', 'utf8');

const isCRLF = app.includes('\r\n');
const nl = isCRLF ? '\r\n' : '\n';

// 1. DOMContentLoaded initialization
const initTarget = [
  "  if (typeof window.initJacketViewer === 'function') {",
  "    window.initJacketViewer('#heroJacketContainer');",
  "  }"
].join(nl);

const initReplacement = [
  "  if (typeof window.initJacketViewer === 'function') {",
  "    window.heroJacketViewer = window.initJacketViewer('#heroJacketContainer');",
  "  }",
  "  if (typeof window.initModalJacketViewer === 'function') {",
  "    window.modalJacketViewer = window.initModalJacketViewer('#modalJacketContainer');",
  "  }"
].join(nl);

// 2. openProductModal hook
const openTarget = [
  "  $('#modalImg').src = product.image;",
  "  $('#modalImg').alt = product.name;"
].join(nl);

const openReplacement = [
  "  $('#modalImg').src = product.image;",
  "  $('#modalImg').alt = product.name;",
  "",
  "  if (window.modalJacketViewer) {",
  "    window.modalJacketViewer.loadProduct(product, State.selectedModalColor);",
  "  }"
].join(nl);

// 3. closeProductModal hook
const closeTarget = [
  "function closeProductModal() {",
  "  const modal = $('#productModal');",
  "  modal.classList.remove('open');",
  "  modal.setAttribute('aria-hidden', 'true');",
  "  State.activeModalProduct = null;",
  "}"
].join(nl);

const closeReplacement = [
  "function closeProductModal() {",
  "  const modal = $('#productModal');",
  "  modal.classList.remove('open');",
  "  modal.setAttribute('aria-hidden', 'true');",
  "  State.activeModalProduct = null;",
  "  if (window.modalJacketViewer) {",
  "    window.modalJacketViewer.pause();",
  "  }",
  "}"
].join(nl);

// 4. modalSwatches click hook
const swatchTarget = [
  "    State.selectedModalColor = btn.dataset.color;",
  "  });"
].join(nl);

const swatchReplacement = [
  "    State.selectedModalColor = btn.dataset.color;",
  "    if (window.modalJacketViewer) {",
  "      window.modalJacketViewer.updateColor(btn.dataset.color);",
  "    }",
  "  });"
].join(nl);

let count = 0;
if (app.includes(initTarget)) {
  app = app.replace(initTarget, initReplacement);
  count++;
} else {
  console.log('initTarget not found');
}

if (app.includes(openTarget)) {
  app = app.replace(openTarget, openReplacement);
  count++;
} else {
  console.log('openTarget not found');
}

if (app.includes(closeTarget)) {
  app = app.replace(closeTarget, closeReplacement);
  count++;
} else {
  console.log('closeTarget not found');
}

if (app.includes(swatchTarget)) {
  app = app.replace(swatchTarget, swatchReplacement);
  count++;
} else {
  console.log('swatchTarget not found');
}

console.log('Found and replaced:', count, 'of 4 targets');
if (count === 4) {
  fs.writeFileSync('frontend/app.js', app, 'utf8');
  console.log('Successfully updated frontend/app.js');
} else {
  process.exit(1);
}
