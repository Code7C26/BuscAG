import type { Item, FilterType } from "../types";
import { itemDateInput } from "./itemDate";
import { NEARBY_RADIUS_KM } from "./geo";
export type AdvancedFilters = {
  zone: string;
  from: string;
  to: string;
  ownership: "all" | "mine" | "others";
  sort: "recent" | "oldest" | "distance";
};
export const emptyFilters: AdvancedFilters = {
  zone: "",
  from: "",
  to: "",
  ownership: "all",
  sort: "recent",
};
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export function filterPublications(
  items: Item[],
  args: {
    query: string;
    category: string;
    status: FilterType;
    userId: string;
    advanced: AdvancedFilters;
  },
) {
  const query = normalize(args.query),
    zone = normalize(args.advanced.zone);
  return items
    .filter((item) => {
      const text = normalize(
        [item.title, item.description, item.category, item.locationName].join(
          " ",
        ),
      );
      const day = itemDateInput(item.date).slice(0, 10);
      return (
        (!query || text.includes(query)) &&
        (!zone || normalize(item.locationName).includes(zone)) &&
        (args.category === "Todos" || item.category === args.category) &&
        (args.status === "todos" ||
          (args.status === "perdidos" && item.status === "perdido") ||
          (args.status === "encontrados" && item.status === "encontrado") ||
          (args.status === "cerca" &&
            (item.distanceKm ?? Infinity) <= NEARBY_RADIUS_KM)) &&
        (args.advanced.ownership === "all" ||
          (item.user.id === args.userId) ===
            (args.advanced.ownership === "mine")) &&
        (!args.advanced.from || (day >= args.advanced.from && !!day)) &&
        (!args.advanced.to || (day <= args.advanced.to && !!day))
      );
    })
    .sort((a, b) =>
      args.advanced.sort === "oldest"
        ? a.createdAt.localeCompare(b.createdAt)
        : args.advanced.sort === "distance"
          ? (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) ||
            b.createdAt.localeCompare(a.createdAt)
          : b.createdAt.localeCompare(a.createdAt),
    );
}
