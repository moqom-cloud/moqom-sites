// Copy buttons for code blocks: <button data-copy> copies the text of the nearest <pre>.
document.addEventListener('click', async (event) => {
  const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button[data-copy]');
  if (!button) return;
  const pre = button.closest('.code')?.querySelector('pre');
  if (!pre) return;
  try {
    await navigator.clipboard.writeText(pre.textContent ?? '');
    button.textContent = 'Copied';
  } catch {
    button.textContent = 'Select and copy';
  }
  setTimeout(() => (button.textContent = 'Copy'), 1600);
});
