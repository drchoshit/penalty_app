import { format } from "date-fns";

export function todayYmd() {
  return format(new Date(), "yyyy-MM-dd");
}

export function ymd(d: Date) {
  return format(d, "yyyy-MM-dd");
}
