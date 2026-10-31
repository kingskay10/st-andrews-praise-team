declare namespace Deno {
  const env: {
    get(name: string): string | undefined;
  };
  function serve(handler: (request: Request) => Response | Promise<Response>): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2.49.1' {
  export function createClient(...args: unknown[]): any;
}
