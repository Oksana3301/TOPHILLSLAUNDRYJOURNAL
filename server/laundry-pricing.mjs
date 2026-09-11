import Services from '../dist/services-core.js';
const invalid=message=>Object.assign(new Error(message),{status:400});

export function serviceSelection(p) {
  const ids = p.serviceIds === undefined ? [p.serviceId] : p.serviceIds;
  if (!Array.isArray(ids) || !ids.length || ids.length > 30 || new Set(ids).size !== ids.length)
    throw invalid('Pilih minimal satu paket; paket yang sama cukup dipilih sekali.');
  const available = new Set(Services.catalog().map(s => s.id));
  if (ids.some(id => typeof id !== 'string' || !available.has(id)))
    throw invalid('Pilih paket dari daftar layanan yang tersedia.');
  return [...ids];
}

export function quotePackages(p, customer) {
  const selected = customer.serviceIds || [customer.serviceId];
  const inputs = p.lines === undefined
    ? selected.length === 1 ? [{serviceId:p.serviceId || selected[0],weight:p.weight,quantity:p.quantity}] : []
    : p.lines;
  if (!Array.isArray(inputs) || !inputs.length || inputs.length > 30)
    throw invalid('Isi berat atau jumlah untuk setiap paket yang akan dikerjakan.');
  serviceSelection({serviceIds:inputs.map(x => x?.serviceId)});
  const catalog = Services.catalog();
  const lines = inputs.map(input => {
    const service = catalog.find(s => s.id === input.serviceId);
    const weight = Number(input.weight ?? 0), quantity = Number(input.quantity ?? 0);
    if (!Number.isFinite(weight) || weight < 0 || weight > 1000 || !Number.isFinite(quantity) || quantity < 0 || quantity > 1000)
      throw invalid('Berat atau jumlah paket tidak valid.');
    let q;
    try { q = Services.quote(service, weight, quantity); }
    catch (error) { throw invalid(service.name + ': ' + error.message); }
    if (!q.minimumMet || q.total <= 0) throw invalid(service.name + ': isi jumlah yang valid. ' + Services.rule(service));
    return {service,weight:Services.weighted(service) ? weight : 0,quantity:q.quantity,billedQuantity:q.billedQuantity,total:q.total};
  });
  const total = lines.reduce((sum, line) => sum + line.total, 0);
  if (!Number.isSafeInteger(total) || total > 100000000) throw invalid('Total paket melebihi batas transaksi.');
  // Keep the single-line projection for existing orders and integrations.
  return {...lines[0],lines,total};
}
