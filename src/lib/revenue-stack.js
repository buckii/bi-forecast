// Negatives lower the bar's base instead of hanging below zero, so the top of the stack lands on the net total.
export function stackRevenue(values, keys) {
  const segments = {}
  let base = 0
  for (const key of keys) {
    const value = values[key] || 0
    if (value >= 0) continue
    segments[key] = [base + value, base]
    base += value
  }

  let top = base
  for (const key of keys) {
    const value = values[key] || 0
    if (value < 0) continue
    segments[key] = [top, top + value]
    top += value
  }

  return { segments, base, net: top }
}
