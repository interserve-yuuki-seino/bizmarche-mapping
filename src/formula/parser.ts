import type { ConditionExpr, FormulaExpr } from './ast'

export class FormulaParseError extends Error {
  readonly offset: number

  constructor(message: string, offset = 0) {
    super(message)
    this.name = 'FormulaParseError'
    this.offset = offset
  }
}

type TokenType =
  | 'ident'
  | 'number'
  | 'string'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'eq'
  | 'in'
  | 'eof'

type Token = {
  type: TokenType
  value: string
  pos: number
}

const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_.@]*/

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const s = input.trim()

  while (i < s.length) {
    const pos = i
    const ch = s[i]!

    if (/\s/.test(ch)) {
      i++
      continue
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen', value: '(', pos })
      i++
      continue
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ')', pos })
      i++
      continue
    }
    if (ch === ',') {
      tokens.push({ type: 'comma', value: ',', pos })
      i++
      continue
    }
    if (ch === '=' && s[i + 1] === '=') {
      tokens.push({ type: 'eq', value: '==', pos })
      i += 2
      continue
    }
    if (ch === "'") {
      let value = ''
      i++
      while (i < s.length) {
        const c = s[i]!
        if (c === '\\' && i + 1 < s.length) {
          value += s[i + 1]!
          i += 2
          continue
        }
        if (c === "'") {
          i++
          break
        }
        value += c
        i++
      }
      tokens.push({ type: 'string', value, pos })
      continue
    }
    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(s[i + 1] ?? ''))) {
      let num = ch
      i++
      while (i < s.length && /[0-9.]/.test(s[i]!)) {
        num += s[i]!
        i++
      }
      tokens.push({ type: 'number', value: num, pos })
      continue
    }
    const m = s.slice(i).match(IDENT_RE)
    if (m) {
      const value = m[0]
      if (value.toLowerCase() === 'in') {
        tokens.push({ type: 'in', value: 'in', pos })
      } else {
        tokens.push({ type: 'ident', value, pos })
      }
      i += value.length
      continue
    }

    throw new FormulaParseError(`想定外の文字: ${ch}`, pos)
  }

  tokens.push({ type: 'eof', value: '', pos: i })
  return tokens
}

class Parser {
  private pos = 0
  private readonly tokens: Token[]

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? { type: 'eof', value: '', pos: 0 }
  }

  private advance(): Token {
    const t = this.peek()
    if (t.type !== 'eof') this.pos++
    return t
  }

  private expect(type: TokenType, msg?: string): Token {
    const t = this.advance()
    if (t.type !== type) {
      throw new FormulaParseError(
        msg ?? `期待: ${type}, 実際: ${t.type}`,
        t.pos,
      )
    }
    return t
  }

  parse(): FormulaExpr {
    const expr = this.parseExpr()
    if (this.peek().type !== 'eof') {
      throw new FormulaParseError('式の後に余分なトークンがあります', this.peek().pos)
    }
    return expr
  }

  private parseExpr(): FormulaExpr {
    const t = this.peek()
    if (t.type === 'ident') {
      const name = this.advance().value
      if (this.peek().type === 'lparen') {
        return this.parseCall(name)
      }
      return { type: 'field', name }
    }
    if (t.type === 'number' || t.type === 'string') {
      return this.parseLiteral()
    }
    throw new FormulaParseError('式の開始が不正です', t.pos)
  }

  private parseLiteral(): FormulaExpr {
    const t = this.advance()
    if (t.type === 'number') {
      const n = Number(t.value)
      if (Number.isNaN(n)) {
        throw new FormulaParseError(`数値が不正: ${t.value}`, t.pos)
      }
      return { type: 'literal', value: n }
    }
    if (t.type === 'string') {
      return { type: 'literal', value: t.value }
    }
    throw new FormulaParseError('リテラルが不正です', t.pos)
  }

  private parseCall(name: string): FormulaExpr {
    this.expect('lparen')
    const args: FormulaExpr[] = []

    if (name === 'iif') {
      const cond = this.parseCondition()
      args.push(cond)
      this.expect('comma')
      args.push(this.parseValueArg())
      this.expect('comma')
      args.push(this.parseValueArg())
      this.expect('rparen')
      return { type: 'call', name: 'iif', args }
    }

    if (name === 'expandNo') {
      while (this.peek().type !== 'rparen') {
        if (args.length > 0) this.expect('comma')
        args.push(this.parseValueArg())
      }
      this.expect('rparen')
      return { type: 'call', name: 'expandNo', args }
    }

    // 未知の関数は汎用引数解析
    if (this.peek().type !== 'rparen') {
      do {
        if (args.length > 0) this.expect('comma')
        args.push(this.parseValueArg())
      } while (this.peek().type === 'comma')
    }
    this.expect('rparen')
    return { type: 'call', name, args }
  }

  /** iif 第1引数: field == value | field in (...) */
  private parseCondition(): ConditionExpr {
    const fieldTok = this.expect('ident')
    const field = fieldTok.value

    if (this.peek().type === 'eq') {
      this.advance()
      const rhs = this.parseLiteral()
      if (rhs.type !== 'literal') {
        throw new FormulaParseError('== の右辺はリテラルである必要があります', fieldTok.pos)
      }
      return {
        type: 'condition',
        field,
        op: '==',
        operand: rhs.value,
      }
    }

    if (this.peek().type === 'in') {
      this.advance()
      this.expect('lparen')
      const list: string[] = []
      if (this.peek().type === 'string') {
        list.push((this.parseLiteral() as { value: string }).value as string)
        while (this.peek().type === 'comma') {
          this.advance()
          const lit = this.parseLiteral()
          if (lit.type !== 'literal' || typeof lit.value !== 'string') {
            throw new FormulaParseError('in リストは文字列リテラルのみ', this.peek().pos)
          }
          list.push(lit.value)
        }
      }
      this.expect('rparen')
      return {
        type: 'condition',
        field,
        op: 'in',
        operand: list,
      }
    }

    throw new FormulaParseError(
      '条件には == または in が必要です',
      this.peek().pos,
    )
  }

  /** 値引数: リテラル / 項目参照 */
  private parseValueArg(): FormulaExpr {
    const t = this.peek()
    if (t.type === 'number' || t.type === 'string') {
      return this.parseLiteral()
    }
    if (t.type === 'ident') {
      if (this.peekAheadIsCall()) {
        return this.parseExpr()
      }
      return { type: 'field', name: this.advance().value }
    }
    throw new FormulaParseError('値引数が不正です', t.pos)
  }

  private peekAheadIsCall(): boolean {
    if (this.tokens[this.pos]?.type !== 'ident') return false
    return this.tokens[this.pos + 1]?.type === 'lparen'
  }
}

/** formula 文字列を AST にパース */
export function parseFormula(input: string): FormulaExpr {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new FormulaParseError('式が空です')
  }
  const tokens = tokenize(trimmed)
  return new Parser(tokens).parse()
}

/** パース可能なら AST、不可なら null */
export function tryParseFormula(input: string): FormulaExpr | null {
  try {
    return parseFormula(input)
  } catch {
    return null
  }
}

/** フェーズ1 サンプル式の往復テスト用 */
export const PHASE1_SAMPLE_FORMULAS = [
  'productSign',
  'iif(dataType == 12, 1, 0)',
  "iif(buyerSign in ('40','41','42','43','44','45','46','47','48','49'), 1, 0)",
  "iif(salesDivision in ('1','2','3','4','5'), 1, 0)",
  "expandNo('', 0, 'deliveryStoreStartCd')",
] as const
