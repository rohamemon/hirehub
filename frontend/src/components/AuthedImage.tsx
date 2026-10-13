import { useQuery } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { apiBlob } from "@/services/api";

/** Loads a protected image (needs the Authorization header, so an <img src> can't be used). */
export function Avatar({ userId, enabled, size = 64, name }: { userId: string; enabled: boolean; size?: number; name: string }) {
  const { data } = useQuery({
    queryKey: ["avatar", userId, enabled],
    queryFn: async () => URL.createObjectURL(await apiBlob(`/users/${userId}/avatar`)),
    enabled, staleTime: 5 * 60_000, retry: false,
  });
  const style = { width: size, height: size };
  return data ? (
    <img src={data} alt={`${name}'s profile photo`} style={style} className="rounded-full border border-slate-200 object-cover" />
  ) : (
    <div style={style} aria-hidden className="flex items-center justify-center rounded-full bg-slate-100 text-slate-400"><UserRound className="h-1/2 w-1/2" /></div>
  );
}
