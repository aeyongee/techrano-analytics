import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const COLLECTOR = ["@/lib/collector", "@/lib/collector/*", "@/lib/collector/**"];
const SECRET_CLIENT = ["@/lib/supabase/admin"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),

  // 화면 코드는 수집기와 secret key 클라이언트를 직접 쓰지 않는다(src/server/* 래퍼를 거친다).
  {
    files: ["src/app/**", "src/components/**", "src/features/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: [...COLLECTOR, ...SECRET_CLIENT], message: "화면 코드는 src/server/* 래퍼를 거쳐야 한다." },
          ],
        },
      ],
    },
  },

  // 수집기는 Next 없이 CLI에서도 돈다.
  {
    files: ["src/lib/collector/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "server-only", message: "수집기는 tsx CLI에서도 돌아야 한다. src/server/collector.ts에서 감싼다." }],
          patterns: [{ group: ["next", "next/*", "@/lib/supabase/server"], message: "수집기는 Next 모듈을 쓰지 않는다." }],
        },
      ],
    },
  },

  // 데모는 실데이터·수집·인증 코드에 닿을 수 없다(실제 DB 쿼리 0건 보장).
  {
    files: ["src/app/demo/**", "src/lib/data/demo/**", "src/lib/actions/demo.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "next/headers", message: "데모는 쿠키·헤더를 읽지 않는다." }],
          patterns: [
            {
              group: [
                "@/lib/supabase",
                "@/lib/supabase/*",
                "@/lib/data/live",
                "@/lib/auth",
                "@/lib/auth/*",
                "@/server",
                "@/server/*",
                "@/app/(live)/*",
                ...COLLECTOR,
              ],
              message: "데모 코드는 실데이터·수집·인증 모듈을 가져올 수 없다.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
