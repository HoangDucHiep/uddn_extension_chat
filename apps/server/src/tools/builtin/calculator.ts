/**
 * Tool `calculator` — tinh bieu thuc so hoc (FR-TOOLS-01/02 — T-M2-07).
 *
 * **Khong dung `eval`** (rule CSP/an toan cua project) → tu viet:
 * tokenizer → shunting-yard → RPN → interpreter.
 *
 * Ho tro:
 *  - Toan tu: `+` `-` `*` `/` `%` `^` (luy thua, phai ben phai)
 *  - Ngoac: `( )`
 *  - Hang so: `pi`, `e`
 *  - Ham: `sqrt` `abs` `round` `floor` `ceil` `min` `max` `pow`
 *  - Phan am: `-2`, `-(1+2)`
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.26.1
 */

import { z } from 'zod'
import type { ToolResult } from '@sidekick/shared'
import type { Tool, ToolContext } from '../types.js'

/** Do dai toi da cua bieu thuc (ky tu) — chan bieu thuc qua lon. */
export const MAX_EXPRESSION_LENGTH = 200

/** Error code cua tool — dung chung cho ca loi parse va loi tinh. */
export const TOOL_ERROR_CODES = {
  INVALID_EXPRESSION: 'TOOL_INVALID_EXPRESSION',
  DIVISION_BY_ZERO: 'TOOL_DIVISION_BY_ZERO',
  UNKNOWN_FUNCTION: 'TOOL_UNKNOWN_FUNCTION',
  OVERFLOW: 'TOOL_OVERFLOW',
} as const

/** Loi cua tool — khong throw ra ngoai, duoc bat trong `execute`. */
export class ToolExecutionError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ToolExecutionError'
    this.code = code
  }
}

/** Schema tham so cua tool — validate tai bien (rule coding-standards). */
export const calculatorArgsSchema = z.object({
  expression: z.string().min(1).max(MAX_EXPRESSION_LENGTH),
})

/** So chinh xac toi da cua ket qua (chu so thap phan). */
const RESULT_PRECISION = 10

/** Do lon toi da cua ket qua — chan tran so. */
const MAX_RESULT_MAGNITUDE = 1e15

interface Token {
  type: 'number' | 'ident' | 'operator' | 'lparen' | 'rparen' | 'comma'
  value: string
}

/** Do uu tien cua toan tu nhi phan (cao hon → gan toi duoi). */
const BINARY_PRECEDENCE: Readonly<Record<string, number>> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '%': 2,
  '^': 3,
}

/**
 * Do uu tien cua toan tu nhi phan.
 *
 * Dat **giua** `*` (2) va `^` (3) → `-2^2 = -(2^2) = -4` (quy uoc toan hoc)
 * nhung `-2*3 = (-2)*3 = -6`.
 */
const UNARY_PRECEDENCE = 2.5

/** Toan tu gan phai → khong pop toan tu cung do uu tien khi gap toan tu moi. */
const RIGHT_ASSOCIATIVE = new Set(['^', 'u+', 'u-'])

/** Hang so mac dinh. */
const CONSTANTS: Readonly<Record<string, number>> = {
  pi: Math.PI,
  e: Math.E,
}

/** Hang so → gia tri, dung khi interpreter gap token hang so. */
const CONSTANT_VALUES: Readonly<Record<string, number>> = CONSTANTS

/** Ham va so tham so cua no. */
const FUNCTIONS: Readonly<Record<string, number>> = {
  sqrt: 1,
  abs: 1,
  round: 1,
  floor: 1,
  ceil: 1,
  min: 2,
  max: 2,
  pow: 2,
}

/** Token hoa mot bieu thuc thanh danh sach token. */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let index = 0

  while (index < source.length) {
    const char = source[index] as string

    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      index += 1
      continue
    }

    // So thuc: chu so hoac dau cham theo sau chu so.
    if (isDigit(char) || (char === '.' && isDigit(source[index + 1] ?? ''))) {
      let end = index
      while (end < source.length && isDigit(source[end] as string)) {
        end += 1
      }
      if (source[end] === '.') {
        end += 1
        while (end < source.length && isDigit(source[end] as string)) {
          end += 1
        }
      }
      const raw = source.slice(index, end)
      if (raw === '.') {
        throw new ToolExecutionError(
          TOOL_ERROR_CODES.INVALID_EXPRESSION,
          'So thuc khong hop le',
        )
      }
      tokens.push({ type: 'number', value: raw })
      index = end
      continue
    }

    // Ten ham / hang so.
    if (isLetter(char)) {
      let end = index
      while (end < source.length && isLetter(source[end] as string)) {
        end += 1
      }
      tokens.push({ type: 'ident', value: source.slice(index, end).toLowerCase() })
      index = end
      continue
    }

    if (char === '(') {
      tokens.push({ type: 'lparen', value: char })
      index += 1
      continue
    }
    if (char === ')') {
      tokens.push({ type: 'rparen', value: char })
      index += 1
      continue
    }
    if (char === ',') {
      tokens.push({ type: 'comma', value: char })
      index += 1
      continue
    }
    if ('+-*/%^'.includes(char)) {
      tokens.push({ type: 'operator', value: char })
      index += 1
      continue
    }

    throw new ToolExecutionError(
      TOOL_ERROR_CODES.INVALID_EXPRESSION,
      `Ky tu khong hop le: "${char}"`,
    )
  }

  return tokens
}

/**
 * Chuyen danh sach token thanh RPN (Reverse Polish Notation).
 *
 * Thuat toan shunting-yard: toan tu chua xu ly nam tren stack, toan tu
 * da xu ly xep vao RPN.
 */
export function toRpn(tokens: readonly Token[]): string[] {
  const output: string[] = []
  const stack: string[] = []
  /** Dang cho mot operand (moi sau toan tu / mo ngoac / dau bang). */
  let expectOperand = true

  for (const token of tokens) {
    if (token.type === 'number') {
      output.push(token.value)
      expectOperand = false
      continue
    }

    if (token.type === 'ident') {
      if (!expectOperand) {
        throw new ToolExecutionError(
          TOOL_ERROR_CODES.INVALID_EXPRESSION,
          `Toan hang khong hop le: "${token.value}"`,
        )
      }
      if (token.value in CONSTANTS) {
        output.push(token.value)
        expectOperand = false
        continue
      }
      if (!(token.value in FUNCTIONS)) {
        throw new ToolExecutionError(
          TOOL_ERROR_CODES.UNKNOWN_FUNCTION,
          `Ham khong ton tai: "${token.value}"`,
        )
      }
      // Ten ham → danh dau de biet khi gap ')' day la ham.
      stack.push(`fn:${token.value}`)
      continue
    }

    if (token.type === 'lparen') {
      stack.push('(')
      expectOperand = true
      continue
    }

    if (token.type === 'comma') {
      // Pop toan tu den khi gap '(' — dau phan thuoc ham.
      while (stack.length > 0 && stack[stack.length - 1] !== '(') {
        output.push(stack.pop() as string)
      }
      if (stack.length === 0) {
        throw new ToolExecutionError(
          TOOL_ERROR_CODES.INVALID_EXPRESSION,
          'Dau phan thuoc khong hop le',
        )
      }
      expectOperand = true
      continue
    }

    if (token.type === 'rparen') {
      while (stack.length > 0 && stack[stack.length - 1] !== '(') {
        output.push(stack.pop() as string)
      }
      if (stack.length === 0) {
        throw new ToolExecutionError(
          TOOL_ERROR_CODES.INVALID_EXPRESSION,
          'Thieu dau ngoac dong',
        )
      }
      stack.pop() // bo '('
      // Neu phan tu duoi la ten ham → day vao RPN.
      const top = stack[stack.length - 1]
      if (top !== undefined && top.startsWith('fn:')) {
        stack.pop()
        output.push(top)
      }
      expectOperand = false
      continue
    }

    // Toan tu.
    const isUnary = expectOperand && (token.value === '+' || token.value === '-')
    const operator = isUnary ? `u${token.value}` : token.value
    const precedence = isUnary ? UNARY_PRECEDENCE : (BINARY_PRECEDENCE[token.value] ?? 0)

    while (stack.length > 0) {
      const top = stack[stack.length - 1] as string
      if (top === '(') break
      const topPrecedence = top.startsWith('u')
        ? UNARY_PRECEDENCE
        : (BINARY_PRECEDENCE[top] ?? 0)
      const shouldPop =
        topPrecedence > precedence ||
        (topPrecedence === precedence && !RIGHT_ASSOCIATIVE.has(operator))
      if (!shouldPop) break
      output.push(stack.pop() as string)
    }

    stack.push(operator)
    expectOperand = true
  }

  while (stack.length > 0) {
    const top = stack.pop() as string
    if (top === '(') {
      throw new ToolExecutionError(
        TOOL_ERROR_CODES.INVALID_EXPRESSION,
        'Thieu dau ngoac dong',
      )
    }
    output.push(top)
  }

  return output
}

/** Tinh gia tri 1 RPN. */
export function evaluateRpn(rpn: readonly string[]): number {
  const stack: number[] = []

  for (const item of rpn) {
    if (isNumericLiteral(item)) {
      stack.push(Number(item))
      continue
    }

    // Hang so (`pi`, `e`) → gia tri cua no.
    const constant = CONSTANT_VALUES[item]
    if (constant !== undefined) {
      stack.push(constant)
      continue
    }

    if (item === 'u+' || item === 'u-') {
      const value = popValue(stack)
      stack.push(item === 'u-' ? -value : value)
      continue
    }

    if (item.startsWith('fn:')) {
      const name = item.slice(3)
      const arity = FUNCTIONS[name]
      if (arity === undefined) {
        throw new ToolExecutionError(
          TOOL_ERROR_CODES.UNKNOWN_FUNCTION,
          `Ham khong ton tai: "${name}"`,
        )
      }
      const args: number[] = []
      for (let i = 0; i < arity; i += 1) {
        args.unshift(popValue(stack))
      }
      stack.push(applyFunction(name, args))
      continue
    }

    const right = popValue(stack)
    const left = popValue(stack)
    stack.push(applyBinaryOperator(item, left, right))
  }

  if (stack.length !== 1) {
    throw new ToolExecutionError(
      TOOL_ERROR_CODES.INVALID_EXPRESSION,
      'Bieu thuc khong hop le',
    )
  }

  const result = stack[0] as number
  if (!Number.isFinite(result)) {
    throw new ToolExecutionError(
      TOOL_ERROR_CODES.OVERFLOW,
      'Ket qua vuot gioi han so hoc',
    )
  }
  if (Math.abs(result) > MAX_RESULT_MAGNITUDE) {
    throw new ToolExecutionError(
      TOOL_ERROR_CODES.OVERFLOW,
      'Ket qua vuot gioi han so hoc',
    )
  }
  return result
}

/**
 * Tinh 1 bieu thuc so hoc.
 *
 * @param expression - Bieu thuc can tinh.
 * @returns Ket qua da lam tron.
 * @throws ToolExecutionError - Khi bieu thuc khong hop le.
 */
export function evaluateExpression(expression: string): number {
  const trimmed = expression.trim()
  if (trimmed.length === 0) {
    throw new ToolExecutionError(
      TOOL_ERROR_CODES.INVALID_EXPRESSION,
      'Bieu thuc rong',
    )
  }
  if (trimmed.length > MAX_EXPRESSION_LENGTH) {
    throw new ToolExecutionError(
      TOOL_ERROR_CODES.INVALID_EXPRESSION,
      `Bieu thuc qua dai (toi da ${MAX_EXPRESSION_LENGTH} ky tu)`,
    )
  }

  const rpn = toRpn(tokenize(trimmed))
  return evaluateRpn(rpn)
}

/**
 * Chuyen ket qua thanh chuoi de hien thi.
 *
 * Lam tron `RESULT_PRECISION` chu so thap phan roi bo cac so 0 thua.
 */
export function formatResult(value: number): string {
  const rounded = Number(value.toFixed(RESULT_PRECISION))
  return String(rounded)
}

/** Pop 1 gia tri tu stack — loi neu stack rong (RPN khong hop le). */
function popValue(stack: number[]): number {
  const value = stack.pop()
  if (value === undefined) {
    throw new ToolExecutionError(
      TOOL_ERROR_CODES.INVALID_EXPRESSION,
      'Bieu thuc khong hop le',
    )
  }
  return value
}

/** Ap dung toan tu nhi phan. */
function applyBinaryOperator(operator: string, left: number, right: number): number {
  switch (operator) {
    case '+':
      return left + right
    case '-':
      return left - right
    case '*':
      return left * right
    case '/':
      if (right === 0) {
        throw new ToolExecutionError(
          TOOL_ERROR_CODES.DIVISION_BY_ZERO,
          'Chia cho 0',
        )
      }
      return left / right
    case '%':
      if (right === 0) {
        throw new ToolExecutionError(
          TOOL_ERROR_CODES.DIVISION_BY_ZERO,
          'Chia cho 0',
        )
      }
      return left % right
    case '^':
      return left ** right
    default:
      throw new ToolExecutionError(
        TOOL_ERROR_CODES.INVALID_EXPRESSION,
        `Toan tu khong ho tro: "${operator}"`,
      )
  }
}

/** Ap dung ham 1 arg hoac 2 args. */
function applyFunction(name: string, args: readonly number[]): number {
  const first = args[0] as number
  switch (name) {
    case 'sqrt':
      if (first < 0) {
        throw new ToolExecutionError(
          TOOL_ERROR_CODES.INVALID_EXPRESSION,
          'Sqrt cua so am khong hop le',
        )
      }
      return Math.sqrt(first)
    case 'abs':
      return Math.abs(first)
    case 'round':
      return Math.round(first)
    case 'floor':
      return Math.floor(first)
    case 'ceil':
      return Math.ceil(first)
    case 'min':
      return Math.min(first, args[1] as number)
    case 'max':
      return Math.max(first, args[1] as number)
    case 'pow':
      return first ** (args[1] as number)
    default:
      throw new ToolExecutionError(
        TOOL_ERROR_CODES.UNKNOWN_FUNCTION,
        `Ham khong ton tai: "${name}"`,
      )
  }
}

/** Chuoi la so thuc hop le (khong phai ten ham/hang so). */
function isNumericLiteral(value: string): boolean {
  if (value.length === 0) return false
  const first = value[0] as string
  if (!isDigit(first) && first !== '.') return false
  return !Number.isNaN(Number(value))
}

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9'
}

function isLetter(char: string): boolean {
  return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')
}

/**
 * Tool `calculator` — dung trong registry.
 *
 * Read-only → `requiresApproval: false`.
 */
export const calculatorTool: Tool = {
  name: 'calculator',
  description:
    'Tinh mot bieu thuc so hoc. Ho tro toan tu + - * / % ^, ngoac, hang so pi/e ' +
    'va ham sqrt, abs, round, floor, ceil, min, max, pow. Dung khi can tinh chinh xac ' +
    'thay vi uoc luong bang model.',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Bieu thuc so hoc can tinh, vi du "2*(3+4)".',
      },
    },
    required: ['expression'],
  },
  requiresApproval: false,
  async execute(args: unknown, _ctx: ToolContext): Promise<ToolResult> {
    const parsed = calculatorArgsSchema.safeParse(args)
    if (!parsed.success) {
      return {
        ok: false,
        output: 'Tham so khong hop le: can `expression` la chuoi.',
        error: 'VALIDATION_ERROR',
      }
    }

    try {
      const value = evaluateExpression(parsed.data.expression)
      return { ok: true, output: formatResult(value) }
    } catch (error) {
      if (error instanceof ToolExecutionError) {
        return { ok: false, output: error.message, error: error.code }
      }
      return {
        ok: false,
        output: 'Khong tinh duoc bieu thuc.',
        error: 'TOOL_ERROR',
      }
    }
  },
}
