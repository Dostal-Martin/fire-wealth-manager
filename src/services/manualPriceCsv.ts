import type {
  ImportedPrice,
} from './manualValuation'

function parseCzechDate(
  text: string
) {
  const normalized =
    text.trim()

  const match =
    normalized.match(
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/
    )

  if (!match) {
    return null
  }

  const day =
    match[1].padStart(
      2,
      '0'
    )

  const month =
    match[2].padStart(
      2,
      '0'
    )

  const year =
    match[3]

  return `${year}-${month}-${day}`
}

function parseNumber(
  text: string
) {
  const normalized =
    text
      .trim()
      .replace(/\s/g, '')
      .replace(',', '.')

  const value =
    Number(normalized)

  return Number.isFinite(value)
    ? value
    : null
}

function detectSeparator(
  header: string
) {
  if (header.includes(';')) {
    return ';'
  }

  if (header.includes('\t')) {
    return '\t'
  }

  return ','
}

export function parseManualPriceCsv(
  content: string
): ImportedPrice[] {
  const lines =
    content
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map(
        (line) =>
          line.trim()
      )
      .filter(Boolean)

  if (lines.length < 2) {
    throw new Error(
      'CSV neobsahuje datové řádky.'
    )
  }

  const separator =
    detectSeparator(
      lines[0]
    )

  const rows:
    ImportedPrice[] = []

  for (
    let index = 1;
    index < lines.length;
    index++
  ) {
    const columns =
      lines[index]
        .split(separator)
        .map(
          (column) =>
            column
              .trim()
              .replace(
                /^"|"$/g,
                ''
              )
        )

    if (columns.length < 2) {
      continue
    }

    const date =
      parseCzechDate(
        columns[0]
      )

    const price =
      parseNumber(
        columns[1]
      )

    if (
      !date ||
      price === null ||
      price <= 0
    ) {
      continue
    }

    rows.push({
      price_date:
        date,

      close_price:
        price,
    })
  }

  const unique =
    new Map<
      string,
      ImportedPrice
    >()

  for (const row of rows) {
    unique.set(
      row.price_date,
      row
    )
  }

  return Array.from(
    unique.values()
  ).sort(
    (a, b) =>
      a.price_date.localeCompare(
        b.price_date
      )
  )
}