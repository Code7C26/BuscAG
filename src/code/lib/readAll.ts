/** Follow actual returned ranges, including servers with a lower max_rows cap. */
export async function readAll<Row>(
  page: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown; count?: number | null }>,
  isCurrent: () => boolean = () => true,
): Promise<Row[]> {
  const result: Row[] = [];
  let expectedTotal: number | null = null;
  for (;;) {
    if (!isCurrent()) throw new Error('La sesión cambió.');
    const { data, error, count } = await page(result.length, result.length + 99);
    if (!isCurrent()) throw new Error('La sesión cambió.');
    if (error) throw error;
    if (!data?.length) return result;
    result.push(...data);
    if (count != null) expectedTotal = count;
    if (expectedTotal != null && result.length >= expectedTotal) return result;
  }
}
