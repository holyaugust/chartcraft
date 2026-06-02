import type { TableData } from '../types'

export type FormulaError = '#ERROR!' | '#REF!' | '#CYCLE!'

function isFormulaError(value: string): value is FormulaError {
  return value === '#ERROR!' || value === '#REF!' || value === '#CYCLE!'
}

export function isFormula(value: string): boolean {
  return value.trimStart().startsWith('=')
}

export function cellAddress(row: number, col: number, options?: { colAbs?: boolean; rowAbs?: boolean }): string {
  const colAbs = options?.colAbs ?? false
  const rowAbs = options?.rowAbs ?? false
  return `${colAbs ? '$' : ''}${colToLetter(col)}${rowAbs ? '$' : ''}${row + 1}`
}

export function colToLetter(col: number): string {
  let n = col + 1
  let result = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    result = String.fromCharCode(65 + rem) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}

/** Excel 单元格引用：A1、$A$1、$A1、A$1 */
export interface ParsedCellRef {
  row: number
  col: number
  colAbs: boolean
  rowAbs: boolean
}

export function parseCellRef(ref: string): ParsedCellRef | null {
  const match = ref.trim().match(/^(\$?)([A-Z]+)(\$?)(\d+)$/i)
  if (!match) return null

  const colAbs = match[1] === '$'
  const letters = match[2].toUpperCase()
  const rowAbs = match[3] === '$'
  const row = parseInt(match[4], 10) - 1
  const col = letterToCol(letters)
  if (row < 0 || col < 0) return null

  return { row, col, colAbs, rowAbs }
}

export function formatCellRef(ref: ParsedCellRef): string {
  return `${ref.colAbs ? '$' : ''}${colToLetter(ref.col)}${ref.rowAbs ? '$' : ''}${ref.row + 1}`
}

/** F4 循环：A1 → $A$1 → A$1 → $A1 → A1 */
export function cycleCellReference(ref: string): string {
  const parsed = parseCellRef(ref)
  if (!parsed) return ref

  const { colAbs, rowAbs } = parsed
  if (!colAbs && !rowAbs) {
    return formatCellRef({ ...parsed, colAbs: true, rowAbs: true })
  }
  if (colAbs && rowAbs) {
    return formatCellRef({ ...parsed, colAbs: false, rowAbs: true })
  }
  if (!colAbs && rowAbs) {
    return formatCellRef({ ...parsed, colAbs: true, rowAbs: false })
  }
  return formatCellRef({ ...parsed, colAbs: false, rowAbs: false })
}

export function cycleFormulaReferenceAtCursor(
  formula: string,
  cursorPos: number,
): { formula: string; cursorPos: number } | null {
  const re = /\$?[A-Z]+\$?\d+/gi
  let match: RegExpExecArray | null
  let target: { index: number; text: string } | null = null

  while ((match = re.exec(formula)) !== null) {
    const start = match.index
    const end = start + match[0].length
    if (cursorPos > start && cursorPos <= end) {
      target = { index: start, text: match[0] }
    }
  }

  if (!target) return null

  const cycled = cycleCellReference(target.text)
  const newFormula = formula.slice(0, target.index) + cycled + formula.slice(target.index + target.text.length)
  const offsetInRef = Math.min(cursorPos - target.index, cycled.length)
  return { formula: newFormula, cursorPos: target.index + offsetInRef }
}

export function parseCellAddress(ref: string): { row: number; col: number } | null {
  const parsed = parseCellRef(ref)
  if (!parsed) return null
  return { row: parsed.row, col: parsed.col }
}

/** Excel 风格公式引用配色 */
export const FORMULA_REF_COLORS = [
  { border: '#4472C4', bg: 'rgba(68, 114, 196, 0.18)', text: '#2F5597' },
  { border: '#ED7D31', bg: 'rgba(237, 125, 49, 0.18)', text: '#C65911' },
  { border: '#A5A5A5', bg: 'rgba(165, 165, 165, 0.2)', text: '#595959' },
  { border: '#FFC000', bg: 'rgba(255, 192, 0, 0.22)', text: '#BF8F00' },
  { border: '#5B9BD5', bg: 'rgba(91, 155, 213, 0.18)', text: '#2E75B6' },
  { border: '#70AD47', bg: 'rgba(112, 173, 71, 0.18)', text: '#548235' },
  { border: '#7030A0', bg: 'rgba(112, 48, 160, 0.15)', text: '#7030A0' },
  { border: '#C00000', bg: 'rgba(192, 0, 0, 0.12)', text: '#C00000' },
] as const

export interface FormulaReference {
  text: string
  start: number
  end: number
  colorIndex: number
  cells: Array<{ row: number; col: number }>
}

function expandRangeToCells(startRef: string, endRef: string): Array<{ row: number; col: number }> {
  const start = parseCellRef(startRef)
  const end = parseCellRef(endRef)
  if (!start || !end) return []

  const r1 = Math.min(start.row, end.row)
  const r2 = Math.max(start.row, end.row)
  const c1 = Math.min(start.col, end.col)
  const c2 = Math.max(start.col, end.col)
  const cells: Array<{ row: number; col: number }> = []

  for (let row = r1; row <= r2; row++) {
    for (let col = c1; col <= c2; col++) {
      cells.push({ row, col })
    }
  }
  return cells
}

/** 解析公式中的单元格/区域引用，用于彩色高亮 */
export function parseFormulaReferences(formula: string): FormulaReference[] {
  if (!isFormula(formula)) return []

  const tokenRe = /(\$?[A-Z]+\$?\d+)(\s*:\s*(\$?[A-Z]+\$?\d+))?/gi
  const raw: Array<Omit<FormulaReference, 'colorIndex'>> = []
  let match: RegExpExecArray | null

  while ((match = tokenRe.exec(formula)) !== null) {
    const start = match.index
    const end = start + match[0].length
    const cells = match[3]
      ? expandRangeToCells(match[1], match[3])
      : (() => {
          const pos = parseCellRef(match[1])
          return pos ? [{ row: pos.row, col: pos.col }] : []
        })()

    if (cells.length > 0) {
      raw.push({ text: match[0], start, end, cells })
    }
  }

  return raw.map((ref, index) => ({
    ...ref,
    colorIndex: index % FORMULA_REF_COLORS.length,
  }))
}

export function buildFormulaRefColorMap(formula: string): Map<string, number> {
  const map = new Map<string, number>()
  for (const ref of parseFormulaReferences(formula)) {
    for (const cell of ref.cells) {
      map.set(`${cell.row},${cell.col}`, ref.colorIndex)
    }
  }
  return map
}

export function getFormulaRefCellStyle(colorIndex: number): {
  boxShadow: string
  backgroundColor: string
} {
  const color = FORMULA_REF_COLORS[colorIndex % FORMULA_REF_COLORS.length]
  return {
    boxShadow: `inset 0 0 0 2px ${color.border}`,
    backgroundColor: color.bg,
  }
}

function letterToCol(letters: string): number {
  let col = 0
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64)
  }
  return col - 1
}

function parsePlainNumber(value: string): number | null {
  const cleaned = value.replace(/[,，%％\s]/g, '')
  if (cleaned === '') return null
  const num = parseFloat(cleaned)
  return Number.isFinite(num) ? num : null
}

function getCellNumeric(
  data: TableData,
  row: number,
  col: number,
  stack: Set<string>,
): number | FormulaError {
  if (row < 0 || col < 0 || row >= data.length || col >= (data[row]?.length ?? 0)) {
    return '#REF!'
  }

  const key = cellKey(row, col)
  if (stack.has(key)) return '#CYCLE!'

  const raw = (data[row][col] ?? '').trim()
  if (raw === '') return 0

  if (isFormula(raw)) {
    stack.add(key)
    const result = evaluateFormulaExpression(raw.slice(1).trim(), data, stack)
    stack.delete(key)
    return result
  }

  const num = parsePlainNumber(raw)
  return num ?? 0
}

function cellKey(row: number, col: number): string {
  return `${row},${col}`
}

function getRangeValues(
  startRef: string,
  endRef: string,
  data: TableData,
  stack: Set<string>,
): (number | FormulaError)[] {
  const start = parseCellAddress(startRef)
  const end = parseCellAddress(endRef)
  if (!start || !end) return ['#REF!']

  const r1 = Math.min(start.row, end.row)
  const r2 = Math.max(start.row, end.row)
  const c1 = Math.min(start.col, end.col)
  const c2 = Math.max(start.col, end.col)

  const values: (number | FormulaError)[] = []
  for (let row = r1; row <= r2; row++) {
    for (let col = c1; col <= c2; col++) {
      values.push(getCellNumeric(data, row, col, stack))
    }
  }
  return values
}

function splitFunctionArgs(argsStr: string): string[] {
  const args: string[] = []
  let current = ''
  let depth = 0

  for (const ch of argsStr) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      args.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }

  if (current.trim()) args.push(current.trim())
  return args
}

function resolveArgValues(
  arg: string,
  data: TableData,
  stack: Set<string>,
): (number | FormulaError)[] {
  const trimmed = arg.trim()
  const rangeMatch = trimmed.match(/^(\$?[A-Z]+\$?\d+)\s*:\s*(\$?[A-Z]+\$?\d+)$/i)
  if (rangeMatch) {
    return getRangeValues(rangeMatch[1], rangeMatch[2], data, stack)
  }

  const cellMatch = trimmed.match(/^(\$?[A-Z]+\$?\d+)$/i)
  if (cellMatch) {
    const pos = parseCellAddress(cellMatch[1])
    if (!pos) return ['#REF!']
    return [getCellNumeric(data, pos.row, pos.col, stack)]
  }

  const num = parsePlainNumber(trimmed)
  if (num !== null) return [num]

  const evaluated = evaluateFormulaExpression(trimmed, data, stack)
  if (typeof evaluated === 'string') return [evaluated]
  return [evaluated]
}

function firstError(values: (number | FormulaError)[]): FormulaError | null {
  for (const value of values) {
    if (typeof value === 'string') return value
  }
  return null
}

function computeFunction(
  name: string,
  argsStr: string,
  data: TableData,
  stack: Set<string>,
): number | FormulaError {
  const args = splitFunctionArgs(argsStr)

  if (name === 'ROUND') {
    const values = resolveArgValues(args[0] ?? '0', data, stack)
    const err = firstError(values)
    if (err) return err
    const digits = parseInt((args[1] ?? '0').trim(), 10)
    const factor = 10 ** (Number.isFinite(digits) ? digits : 0)
    return Math.round((values[0] as number) * factor) / factor
  }

  const numbers: number[] = []
  for (const arg of args) {
    const resolved = resolveArgValues(arg, data, stack)
    const err = firstError(resolved)
    if (err) return err
    numbers.push(...(resolved as number[]))
  }

  if (numbers.length === 0) return 0

  switch (name) {
    case 'SUM':
    case 'PRODUCT':
      return numbers.reduce((acc, n) => (name === 'SUM' ? acc + n : acc * n), name === 'SUM' ? 0 : 1)
    case 'AVERAGE':
    case 'AVG':
      return numbers.reduce((acc, n) => acc + n, 0) / numbers.length
    case 'MIN':
      return Math.min(...numbers)
    case 'MAX':
      return Math.max(...numbers)
    case 'COUNT':
      return numbers.length
    default:
      return '#ERROR!'
  }
}

function processFunctions(expr: string, data: TableData, stack: Set<string>): string | FormulaError {
  let result = expr
  const funcRegex = /(SUM|AVERAGE|AVG|MIN|MAX|COUNT|PRODUCT|ROUND)\(([^()]*)\)/i

  for (let guard = 0; guard < 50; guard++) {
    const match = result.match(funcRegex)
    if (!match) break

    const computed = computeFunction(match[1].toUpperCase(), match[2], data, stack)
    if (typeof computed === 'string') return computed
    result = result.replace(match[0], String(computed))
  }

  return result
}

function replaceCellReferences(expr: string, data: TableData, stack: Set<string>): string {
  return expr.replace(/\$?[A-Z]+\$?\d+/gi, (ref) => {
    const pos = parseCellAddress(ref)
    if (!pos) return '#REF!'
    const value = getCellNumeric(data, pos.row, pos.col, stack)
    if (typeof value === 'string') return value
    return String(value)
  })
}

type Token =
  | { type: 'number'; value: number }
  | { type: 'op'; value: '+' | '-' | '*' | '/' }
  | { type: 'paren'; value: '(' | ')' }

function tokenize(expr: string): Token[] | FormulaError {
  const tokens: Token[] = []
  let i = 0

  while (i < expr.length) {
    const ch = expr[i]
    if (/\s/.test(ch)) {
      i++
      continue
    }

    if ('+-*/'.includes(ch)) {
      tokens.push({ type: 'op', value: ch as '+' | '-' | '*' | '/' })
      i++
      continue
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch })
      i++
      continue
    }

    if (/[0-9.]/.test(ch) || (ch === '-' && (tokens.length === 0 || tokens[tokens.length - 1]?.type === 'op' || tokens[tokens.length - 1]?.value === '('))) {
      let numStr = ch
      i++
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        numStr += expr[i]
        i++
      }
      const num = parseFloat(numStr)
      if (!Number.isFinite(num)) return '#ERROR!'
      tokens.push({ type: 'number', value: num })
      continue
    }

    if (['#ERROR!', '#CYCLE!', '#REF!'].some((err) => expr.slice(i).startsWith(err))) {
      const err = ['#ERROR!', '#CYCLE!', '#REF!'].find((e) => expr.slice(i).startsWith(e))!
      return err as FormulaError
    }

    return '#ERROR!'
  }

  return tokens
}

function evaluateTokens(tokens: Token[]): number | FormulaError {
  let pos = 0

  function parseExpression(): number | FormulaError {
    return parseAddSub()
  }

  function parseAddSub(): number | FormulaError {
    let left = parseMulDiv()
    if (typeof left === 'string') return left

    while (pos < tokens.length && tokens[pos].type === 'op' && (tokens[pos].value === '+' || tokens[pos].value === '-')) {
      const op = tokens[pos].value
      pos++
      const right = parseMulDiv()
      if (typeof right === 'string') return right
      left = op === '+' ? left + right : left - right
    }

    return left
  }

  function parseMulDiv(): number | FormulaError {
    let left = parseUnary()
    if (typeof left === 'string') return left

    while (pos < tokens.length && tokens[pos].type === 'op' && (tokens[pos].value === '*' || tokens[pos].value === '/')) {
      const op = tokens[pos].value
      pos++
      const right = parseUnary()
      if (typeof right === 'string') return right
      if (op === '/' && right === 0) return '#ERROR!'
      left = op === '*' ? left * right : left / right
    }

    return left
  }

  function parseUnary(): number | FormulaError {
    if (tokens[pos]?.type === 'op' && tokens[pos].value === '-') {
      pos++
      const value = parseUnary()
      if (typeof value === 'string') return value
      return -value
    }
    return parsePrimary()
  }

  function parsePrimary(): number | FormulaError {
    const token = tokens[pos]
    if (!token) return '#ERROR!'

    if (token.type === 'number') {
      pos++
      return token.value
    }

    if (token.type === 'paren' && token.value === '(') {
      pos++
      const value = parseExpression()
      if (typeof value === 'string') return value
      if (tokens[pos]?.type !== 'paren' || tokens[pos].value !== ')') return '#ERROR!'
      pos++
      return value
    }

    return '#ERROR!'
  }

  const result = parseExpression()
  if (typeof result === 'string') return result
  if (pos !== tokens.length) return '#ERROR!'
  return result
}

function evaluateMath(expr: string): number | FormulaError {
  if (expr.includes('#REF!')) return '#REF!'
  if (expr.includes('#CYCLE!')) return '#CYCLE!'
  if (expr.includes('#ERROR!')) return '#ERROR!'

  const tokens = tokenize(expr)
  if (typeof tokens === 'string') return tokens
  if (tokens.length === 0) return '#ERROR!'
  return evaluateTokens(tokens)
}

function evaluateFormulaExpression(
  expr: string,
  data: TableData,
  stack: Set<string>,
): number | FormulaError {
  if (!expr) return '#ERROR!'

  const withFunctions = processFunctions(expr, data, stack)
  if (isFormulaError(withFunctions)) return withFunctions

  const withRefs = replaceCellReferences(withFunctions, data, stack)
  if (isFormulaError(withRefs)) return withRefs

  return evaluateMath(withRefs)
}

export function isIncompleteFormula(raw: string): boolean {
  if (!isFormula(raw)) return false
  const expr = raw.slice(1).trim()
  if (!expr) return true
  if (/[+\-*/(,]$/.test(expr)) return true

  const tailMatch = expr.match(/(\$?[A-Z]+\$?\d*)$/i)
  if (tailMatch && !/^(\$?[A-Z]+\$?\d+)(:(\$?[A-Z]+\$?\d+))?$/i.test(tailMatch[0])) {
    return true
  }

  return false
}

export function appendCellReference(formula: string, ref: string, extendRange: boolean): string {
  const upperRef = ref.toUpperCase()
  if (!formula.startsWith('=')) return `=${upperRef}`

  let body = formula.slice(1).trimEnd()
  if (!body) return `=${upperRef}`

  if (extendRange) {
    const rangeMatch = body.match(/(\$?[A-Z]+\$?\d+)\s*:\s*(\$?[A-Z]+\$?\d+)$/i)
    if (rangeMatch) {
      return `=${rangeMatch[1].toUpperCase()}:${upperRef}`
    }
    const cellMatch = body.match(/(\$?[A-Z]+\$?\d+)$/i)
    if (cellMatch) {
      return `=${cellMatch[1].toUpperCase()}:${upperRef}`
    }
  }

  if (/[(,+\-*/]$/.test(body)) {
    return `=${body}${upperRef}`
  }

  if (/\$?[A-Z]+\$?\d+$|\d+$|\)$/.test(body)) {
    return `=${body}+${upperRef}`
  }

  return `=${body}${upperRef}`
}

export function evaluateCell(
  data: TableData,
  row: number,
  col: number,
): number | string {
  const raw = (data[row]?.[col] ?? '').trim()
  if (!isFormula(raw)) return raw
  if (isIncompleteFormula(raw)) return raw

  const result = evaluateFormulaExpression(raw.slice(1).trim(), data, new Set())
  if (typeof result === 'string') return result
  return formatNumber(result)
}

export function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return parseFloat(value.toFixed(6)).toString()
}

export function getCellDisplayValue(data: TableData, row: number, col: number): string {
  const raw = data[row]?.[col] ?? ''
  if (!isFormula(raw)) return raw
  if (isIncompleteFormula(raw)) return ''

  const result = evaluateCell(data, row, col)
  return String(result)
}

export function getComputedTable(data: TableData): TableData {
  return data.map((row, rowIdx) =>
    row.map((cell, colIdx) => {
      if (!isFormula(cell)) return cell
      return getCellDisplayValue(data, rowIdx, colIdx)
    }),
  )
}

export function getCellNumericForChart(value: string): number {
  if (value.startsWith('#')) return 0
  const num = parsePlainNumber(value)
  return num ?? 0
}

function shiftCellRef(refText: string, rowDelta: number, colDelta: number): string {
  const parsed = parseCellRef(refText)
  if (!parsed) return refText

  const newRow = parsed.rowAbs ? parsed.row : parsed.row + rowDelta
  const newCol = parsed.colAbs ? parsed.col : parsed.col + colDelta
  if (newRow < 0 || newCol < 0) return refText

  return formatCellRef({
    row: newRow,
    col: newCol,
    colAbs: parsed.colAbs,
    rowAbs: parsed.rowAbs,
  })
}

export function adjustFormulaReferences(
  formula: string,
  rowDelta: number,
  colDelta: number,
): string {
  if (!isFormula(formula)) return formula

  const body = formula.slice(1).replace(/\$?[A-Z]+\$?\d+/gi, (match) =>
    shiftCellRef(match, rowDelta, colDelta),
  )

  return `=${body}`
}

export function constrainFillEnd(
  source: { row: number; col: number },
  end: { row: number; col: number },
): { row: number; col: number } {
  const rowDiff = Math.abs(end.row - source.row)
  const colDiff = Math.abs(end.col - source.col)

  if (rowDiff >= colDiff) {
    return { row: end.row, col: source.col }
  }

  return { row: source.row, col: end.col }
}

export function applyFormulaFill(
  data: TableData,
  sourceRow: number,
  sourceCol: number,
  endRow: number,
  endCol: number,
): TableData {
  const sourceValue = data[sourceRow]?.[sourceCol] ?? ''
  if (!isFormula(sourceValue)) return data

  const target = constrainFillEnd({ row: sourceRow, col: sourceCol }, { row: endRow, col: endCol })
  const r1 = Math.min(sourceRow, target.row)
  const r2 = Math.max(sourceRow, target.row)
  const c1 = Math.min(sourceCol, target.col)
  const c2 = Math.max(sourceCol, target.col)

  return data.map((row, rowIdx) =>
    row.map((cell, colIdx) => {
      if (rowIdx === sourceRow && colIdx === sourceCol) return cell
      if (rowIdx < r1 || rowIdx > r2 || colIdx < c1 || colIdx > c2) return cell

      const rowDelta = rowIdx - sourceRow
      const colDelta = colIdx - sourceCol
      return adjustFormulaReferences(sourceValue, rowDelta, colDelta)
    }),
  )
}

export function isInFillPreview(
  fillDrag: {
    source: { row: number; col: number }
    end: { row: number; col: number }
  },
  row: number,
  col: number,
): boolean {
  const target = constrainFillEnd(fillDrag.source, fillDrag.end)
  const r1 = Math.min(fillDrag.source.row, target.row)
  const r2 = Math.max(fillDrag.source.row, target.row)
  const c1 = Math.min(fillDrag.source.col, target.col)
  const c2 = Math.max(fillDrag.source.col, target.col)

  if (row < r1 || row > r2 || col < c1 || col > c2) return false
  return !(row === fillDrag.source.row && col === fillDrag.source.col)
}
