import { categoryGradient } from "@/lib/format";

export function EventCover({
  category,
  image,
}: {
  category: string | null;
  image: string | null;
}) {
  let backgroundImage: string | undefined;
  if (image) {
    try {
      const url = new URL(image);
      if (url.protocol === "https:" && !url.username && !url.password) {
        backgroundImage = `url(${JSON.stringify(url.href)})`;
      }
    } catch {
      // Older image references may be invalid. Keep the category gradient.
    }
  }
  return (
    <div
      aria-hidden
      className={`absolute inset-0 bg-cover bg-center bg-gradient-to-br ${categoryGradient(category)}`}
    >
      {backgroundImage ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage }}
        />
      ) : null}
    </div>
  );
}
