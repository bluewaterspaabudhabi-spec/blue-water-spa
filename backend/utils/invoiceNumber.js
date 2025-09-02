export function nextInvoiceNumber(last = null) {
  const now = new Date();
  const prefix = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}`;
  let seq = 1;
  if (last && last.startsWith(prefix)) {
    seq = parseInt(last.split('-')[1] || '0', 10) + 1;
  }
  return `${prefix}-${String(seq).padStart(4,'0')}`;
}
