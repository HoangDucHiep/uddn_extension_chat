/**
 * Tien ich doc flag tu `argv` cho CLI eval.
 *
 * Tach rieng de moi subcommand dung chung 1 bo quy tac parse → tranh
 * moi noi 1 cach xu ly `argv` khac nhau.
 *
 * Docs: docs/EVAL_PLAN.md §7.1
 */

/**
 * Lay gia tri 1 flag tu argv.
 *
 * @param args - Tham so CLI.
 * @param name - Ten flag (vd `--base-url`).
 * @param fallback - Gia tri mac dinh khi khong co flag.
 */
export function readFlag(args: readonly string[], name: string, fallback: string): string {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

/**
 * Doc 1 flag so (mac dinh 0 → tra `undefined`).
 *
 * @param args - Tham so CLI.
 * @param name - Ten flag.
 */
export function readNumberFlag(args: readonly string[], name: string): number | undefined {
  const raw = readFlag(args, name, '')
  if (raw.length === 0) return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

/**
 * Doc 1 flag boolean.
 *
 * @param args - Tham so CLI.
 * @param name - Ten flag.
 */
export function readBoolFlag(args: readonly string[], name: string): boolean {
  return args.includes(name)
}

/**
 * Doc 1 flag danh sach (phan tach bang dau phay **hoac** khoang trang).
 *
 * Ly do: mot so shell (vd PowerShell + pnpm) bien dau phay thanh khoang trang
 * khi truyen qua nhieu tang wrapper → `"a,b"` thanh `"a b"`. Split theo ca hai
 * de lenh chay duoc o moi shell.
 *
 * @param args - Tham so CLI.
 * @param name - Ten flag.
 */
export function readListFlag(args: readonly string[], name: string): string[] | undefined {
  const index = args.indexOf(name)
  if (index === -1) return undefined

  // Gom **tat ca** token sau flag cho den token bat dau bang `--`.
  // Khi shell bien dau phay thanh khoang trang ("a,b" → "a b") thi danh sach
  // nam tren 2 token → phai gom ca 2 vao.
  const values: string[] = []
  for (let i = index + 1; i < args.length; i += 1) {
    const token = args[i]
    if (token === undefined || token.startsWith('--')) break
    values.push(token)
  }

  if (values.length === 0) return undefined

  return values
    .flatMap((value) => value.split(/[,\s]+/))
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}
