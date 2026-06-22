import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/services/api";

export function useAuth() {
  return useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}
