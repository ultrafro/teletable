import { BothHands } from "@/app/teletable.model";

export function copyHands(source: BothHands, target: BothHands) {
  for (const key in source) {
    if (typeof source[key as keyof BothHands] === "object") {
      for (const subKey in source[key as keyof BothHands]) {
        (target as any)[key][subKey] = (source as any)[key][subKey];
      }
    } else {
      (target as any)[key] = (source as any)[key];
    }
  }
}
