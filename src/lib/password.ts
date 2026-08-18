import { hash } from "@node-rs/argon2";

const PEPPER = process.env.PASSWORD_PEPPER || "";

// Lambda(argon2-cffi)와 동일한 파라미터/전처리(NFC + PEPPER) 사용.
// 출력은 PHC 문자열($argon2id$...)로 양쪽이 상호 검증 가능.
// const enum이 isolatedModules와 충돌하여 숫자 리터럴로 지정:
//   algorithm 2 = Argon2id, version 1 = V0x13 (0x13)
// salt 길이는 옵션 미지정 시 기본 16바이트로 Lambda와 동일.
export async function hashUserPassword(plain: string): Promise<string> {
  const input = plain.normalize("NFC") + PEPPER;
  return hash(input, {
    algorithm: 2,
    version: 1,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
    outputLen: 32,
  });
}
