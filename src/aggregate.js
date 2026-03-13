// ═══════════════════════════════════════════════════════════════════
// DATA AGGREGATION  — computes lw / pw / cmp objects for generators
// ═══════════════════════════════════════════════════════════════════

export function _pct(n, total) { return total ? Math.round(n / total * 100) : 0; }

export function toSortedArr(counts, limit = 999) {
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Return human-readable event type label for a CWO / Cases row */
export function getEventLabel(row) {
  const desc = (row.EventType_Description || row.EventTypeDescription || '').trim();
  if (desc && desc !== '0' && desc !== '') return desc;
  const txt = (row.Description || row.Subject || row.Name || row.Title || '').toLowerCase();
  if (!txt) return 'Other';
  if (/aircon|a\.c\.|a\/c|temperature|cooling|hvac|chiller/i.test(txt))    return 'Aircon / Temperature';
  if (/light|lamp|bulb|luminaire|led|fluorescent/i.test(txt))              return 'Lighting Faulty';
  if (/water|leak|plumb|drain|pipe|flood|overflow/i.test(txt))             return 'Water Leak / Plumbing';
  if (/door|lock|access|gate|barrier|hinge|handle/i.test(txt))             return 'Door / Lock';
  if (/lift|elevator|escalator/i.test(txt))                                return 'Lift / Elevator';
  if (/clean|dirt|stain|hygiene|waste|rubbish|trash/i.test(txt))           return 'Cleaning';
  if (/fire|alarm|smoke|sprinkler/i.test(txt))                             return 'Fire Alarm';
  if (/floor|tile|carpet/i.test(txt))                                      return 'Floor / Tile';
  if (/electric|power|socket|outlet|breaker|fuse/i.test(txt))              return 'Electrical';
  if (/toilet|wc|bathroom|sanitary|sewage/i.test(txt))                     return 'Sanitary / WC';
  if (/pest|insect|rodent|cockroach|rat/i.test(txt))                       return 'Pest Control';
  return 'Other';
}

/** Detect closed / cancelled / active status from a CWO or Cases row */
export function getRowStatus(row) {
  const s = (row.StatusId || row.Status || row.WorkOrderStatus || row.CaseStatus || '').toString().toLowerCase();
  if (/cancel/.test(s))                         return 'cancelled';
  if (/clos|resolv|complet|done|finish/.test(s)) return 'resolved';
  if (s === '3' || s === '4' || s === '5')       return 'resolved'; // common Mozart numeric IDs
  return 'active';
}

/** Detect SLA pass / fail from a row */
export function getSLAStatus(row) {
  const failed = (row.IsSLAFailed || '').toString().toLowerCase();
  if (failed === 'true' || failed === '1')  return 'fail';
  if (failed === 'false' || failed === '0') return 'pass';
  const sla = (row.SLAResult || row.SLAPassed || row.IsSLAPassed || row.SLAStatus || '').toString().toLowerCase();
  if (/fail|false|no/.test(sla)) return 'fail';
  return 'pass';
}

export function aggregateCWO(rows) {
  const total = rows.length;
  let resolved = 0, active = 0, cancelled = 0, slaFail = 0, slaPass = 0;
  const priCounts = {}, locCounts = {}, evtCounts = {}, assetCounts = {};
  for (const r of rows) {
    const status = getRowStatus(r);
    if (status === 'cancelled')     cancelled++;
    else if (status === 'resolved') resolved++;
    else                            active++;
    getSLAStatus(r) === 'fail' ? slaFail++ : slaPass++;
    const pri = r.Priority_Name || r.PriorityId || 'Unknown';
    priCounts[pri] = (priCounts[pri] || 0) + 1;
    const loc = r.TopLocation_Name || r.Location_Name || r.LocationId || 'Unknown';
    locCounts[loc] = (locCounts[loc] || 0) + 1;
    const evt = getEventLabel(r);
    evtCounts[evt] = (evtCounts[evt] || 0) + 1;
    const asset = r.Asset_Name || '';
    if (asset) assetCounts[asset] = (assetCounts[asset] || 0) + 1;
  }
  return {
    total, resolved, active, cancelled,
    resolvePct: _pct(resolved, total), activePct: _pct(active, total),
    slaPass, slaFail,
    slaPassPct: _pct(slaPass, total), slaFailPct: _pct(slaFail, total),
    priorities: toSortedArr(priCounts),
    locations:  toSortedArr(locCounts, 6),
    events:     toSortedArr(evtCounts, 10),
    assets:     toSortedArr(assetCounts, 5),
  };
}

export function aggregateCases(rows) {
  const total = rows.length;
  let resolved = 0, active = 0, cancelled = 0, slaFail = 0, slaPass = 0;
  const priCounts = {}, locCounts = {}, evtCounts = {}, assetCounts = {};
  for (const r of rows) {
    const status = getRowStatus(r);
    if (status === 'cancelled')     cancelled++;
    else if (status === 'resolved') resolved++;
    else                            active++;
    getSLAStatus(r) === 'fail' ? slaFail++ : slaPass++;
    const pri = r.Priority_Name || r.PriorityLevelId || 'Unknown';
    priCounts[pri] = (priCounts[pri] || 0) + 1;
    const loc = r.Location_Name || r.LocationId || 'Unknown';
    locCounts[loc] = (locCounts[loc] || 0) + 1;
    const evt = getEventLabel(r);
    evtCounts[evt] = (evtCounts[evt] || 0) + 1;
    const asset = r.Asset_Name || '';
    if (asset) assetCounts[asset] = (assetCounts[asset] || 0) + 1;
  }
  return {
    total, resolved, active, cancelled,
    resolvePct: _pct(resolved, total), activePct: _pct(active, total),
    slaPass, slaFail,
    slaPassPct: _pct(slaPass, total), slaFailPct: _pct(slaFail, total),
    priorities: toSortedArr(priCounts),
    locations:  toSortedArr(locCounts, 6),
    events:     toSortedArr(evtCounts, 10),
    assets:     toSortedArr(assetCounts, 5),
  };
}

export function aggregatePPM(rows) {
  const total = rows.length;
  let closed = 0, inProgress = 0, overdue = 0, cancelled = 0;
  const freqCounts = {}, zoneCounts = {}, catCounts = {};
  for (const r of rows) {
    const isOD  = /true|1|yes/i.test(r.IsOverdue   || '');
    const isCxl = /true|1|yes/i.test(r.IsCancelled || '');
    const isAct = /true|1|yes/i.test(r.IsActive    || '');
    if (isCxl)      cancelled++;
    else if (isOD)  overdue++;
    else if (isAct) inProgress++;
    else            closed++;
    const freq = r.FrequencyType_Name || r.FrequencyId || 'Unknown';
    freqCounts[freq] = (freqCounts[freq] || 0) + 1;
    const zone = r.Location_FloorNo
      ? `Floor ${r.Location_FloorNo}`
      : (r.Location_Name || r.LocationId || 'Unknown');
    zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
    const cat = r.ServiceCategory_Name || r.EventType_Description || r.TaskDescription || 'Uncategorised';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }
  const nonCxl = total - cancelled;
  return {
    total, closed, inProgress, overdue, cancelled,
    closedPct:     _pct(closed,  total),
    overduePct:    _pct(overdue, total),
    compliancePct: _pct(closed,  nonCxl || 1),
    frequencies:   toSortedArr(freqCounts, 8),
    zones:         toSortedArr(zoneCounts, 6),
    categories:    toSortedArr(catCounts, 10),
  };
}

export function evtCountsFromRows(rows) {
  const c = {};
  rows.forEach(r => { const e = getEventLabel(r); c[e] = (c[e] || 0) + 1; });
  return c;
}

export function catCountsFromRows(rows) {
  const c = {};
  rows.forEach(r => {
    const k = r.ServiceCategory_Name || r.EventType_Description || r.TaskDescription || 'Uncategorised';
    c[k] = (c[k] || 0) + 1;
  });
  return c;
}

export function buildCmp(lwC, pwC) {
  return Array.from(new Set([...Object.keys(lwC), ...Object.keys(pwC)]))
    .map(type => ({ type, lw: lwC[type] || 0, pw: pwC[type] || 0, delta: (lwC[type] || 0) - (pwC[type] || 0) }))
    .sort((a, b) => b.lw - a.lw || b.pw - a.pw)
    .slice(0, 12);
}
