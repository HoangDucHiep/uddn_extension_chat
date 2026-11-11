import { describe, expect, it } from 'vitest'
import {
  calculatorTool,
  evaluateExpression,
  formatResult,
  MAX_EXPRESSION_LENGTH,
  ToolExecutionError,
  tokenize,
  toRpn,
} from '../src/tools/builtin/calculator.js'
import type { ToolContext } from '../src/tools/types.js'

/**
 * Unit test cho tool `calculator` (FR-TOOLS-01/02 — T-M2-07).
 *
 * AC goc:
 * - "Khong dung `eval` — shunting-yard → RPN → interpreter".
 * - "Chia cho 0 → loi".
 * - "Bieu thuc qua dai → loi".
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.26.1
 */

const CTX: ToolContext = { requestId: 'req-1' }

/** Bang case bieu thuc → ket qua (hoac loi). */
const CASES: Array<{ expression: string; expected: string }> = [
  { expression: '2+2', expected: '4' },
  { expression: '2*(3+4)', expected: '14' },
  { expression: '10/4', expected: '2.5' },
  { expression: '2^10', expected: '1024' },
  { expression: 'sqrt(9)', expected: '3' },
  { expression: 'abs(-5)', expected: '5' },
  { expression: 'min(3,7)', expected: '3' },
  { expression: 'max(3,7)', expected: '7' },
  { expression: 'round(2.6)', expected: '3' },
  { expression: 'floor(2.9)', expected: '2' },
  { expression: 'ceil(2.1)', expected: '3' },
  { expression: 'pow(2,8)', expected: '256' },
  { expression: '-3+5', expected: '2' },
  { expression: '-(1+2)', expected: '-3' },
  { expression: '2^3^2', expected: '512' },
  { expression: '-2^2', expected: '-4' },
  { expression: '10%3', expected: '1' },
  { expression: '(1+2)*(3+4)', expected: '21' },
  { expression: '  7 * 6  ', expected: '42' },
  { expression: '1.5*2', expected: '3' },
  { expression: 'pi', expected: String(Number(Math.PI.toFixed(10))) },
]

describe('calculator — bieu thuc hop le', () => {
  for (const testCase of CASES) {
    it(`${testCase.expression} = ${testCase.expected}`, () => {
      expect(formatResult(evaluateExpression(testCase.expression))).toBe(testCase.expected)
    })
  }
})

describe('calculator — bieu thuc loi', () => {
  it('chia cho 0 → loi TOOL_DIVISION_BY_ZERO', () => {
    expect(() => evaluateExpression('1/0')).toThrow(ToolExecutionError)
    try {
      evaluateExpression('1/0')
    } catch (error) {
      expect((error as ToolExecutionError).code).toBe('TOOL_DIVISION_BY_ZERO')
    }
  })

  it('chia cho 0 qua % → loi', () => {
    expect(() => evaluateExpression('1%0')).toThrow(ToolExecutionError)
  })

  it('bieu thuc rong → loi', () => {
    expect(() => evaluateExpression('   ')).toThrow(ToolExecutionError)
  })

  it('bieu thuc qua dai → loi', () => {
    const long = '1+'.repeat(MAX_EXPRESSION_LENGTH) + '1'
    expect(() => evaluateExpression(long)).toThrow(ToolExecutionError)
  })

  it('ky tu la → loi (khong crash)', () => {
    expect(() => evaluateExpression('2 $ 3')).toThrow(ToolExecutionError)
  })

  it('ngoac khong khop → loi', () => {
    expect(() => evaluateExpression('(1+2')).toThrow(ToolExecutionError)
    expect(() => evaluateExpression('1+2)')).toThrow(ToolExecutionError)
  })

  it('ham khong ton tai → loi TOOL_UNKNOWN_FUNCTION', () => {
    try {
      evaluateExpression('foo(1)')
      throw new Error('phai throw')
    } catch (error) {
      expect((error as ToolExecutionError).code).toBe('TOOL_UNKNOWN_FUNCTION')
    }
  })

  it('bieu thuc rong giua → loi (khong crash)', () => {
    expect(() => evaluateExpression('1+*2')).toThrow(ToolExecutionError)
  })

  it('sqrt cua so am → loi', () => {
    expect(() => evaluateExpression('sqrt(-1)')).toThrow(ToolExecutionError)
  })
})

describe('calculator — tokenizer + RPN', () => {
  it('tokenize tach duoc so, toan tu, ngoac', () => {
    const tokens = tokenize('1+2*(3-4)')
    expect(tokens.map((token) => token.value)).toEqual([
      '1',
      '+',
      '2',
      '*',
      '(',
      '3',
      '-',
      '4',
      ')',
    ])
  })

  it('tokenize nhan dang so thuc', () => {
    const tokens = tokenize('3.5')
    expect(tokens[0]?.type).toBe('number')
    expect(tokens[0]?.value).toBe('3.5')
  })

  it('toRpn chuyen bieu thuc thanh RPN', () => {
    expect(toRpn(tokenize('2+3*4'))).toEqual(['2', '3', '4', '*', '+'])
  })

  it('toRpn xu ly ngoac', () => {
    expect(toRpn(tokenize('(2+3)*4'))).toEqual(['2', '3', '+', '4', '*'])
  })
})

describe('calculator — tool interface', () => {
  it('tool ten la `calculator` va khong can duyet', () => {
    expect(calculatorTool.name).toBe('calculator')
    expect(calculatorTool.requiresApproval).toBe(false)
  })

  it('execute bieu thuc hop le → ok', async () => {
    const result = await calculatorTool.execute({ expression: '2+2' }, CTX)
    expect(result.ok).toBe(true)
    expect(result.output).toBe('4')
  })

  it('execute thieu tham so → ok:false (khong throw)', async () => {
    const result = await calculatorTool.execute({}, CTX)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('VALIDATION_ERROR')
  })

  it('execute tham so sai kieu → ok:false (khong throw)', async () => {
    const result = await calculatorTool.execute({ expression: 123 }, CTX)
    expect(result.ok).toBe(false)
  })

  it('execute bieu thuc loi → ok:false voi error code', async () => {
    const result = await calculatorTool.execute({ expression: '1/0' }, CTX)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('TOOL_DIVISION_BY_ZERO')
  })

  it('execute expression qua dai → ok:false (validate o bien)', async () => {
    const result = await calculatorTool.execute(
      { expression: '1+'.repeat(MAX_EXPRESSION_LENGTH) + '1' },
      CTX,
    )
    expect(result.ok).toBe(false)
  })
})
