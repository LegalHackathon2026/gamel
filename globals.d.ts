// custom.d.ts  (or globals.d.ts — any name works)
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}