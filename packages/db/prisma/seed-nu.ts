import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const events = [
  [
    "nu-demo-medicine-open-house-2026",
    "NU School of Medicine Open House",
    "Community",
    "2026-11-28T10:00:00+05:00",
    "2026-11-28T15:00:00+05:00",
    "NU School of Medicine",
    "5/1 Kerey and Zhanibek Khan Street",
    "Astana",
    "https://nu.edu.kz/eventsm/open-house-day-at-the-nu-school-of-medicine-2/",
    "https://nu.edu.kz/wp-content/uploads/2026/11/ohd-tv-1280x720-en-aikorkem-bekeyeva-768x432.png",
    "Meet medical students and faculty, explore academic programmes and join campus activities."
  ],
  [
    "nu-demo-day-almaty-2026",
    "NU Day in Almaty",
    "Community",
    "2026-11-28T11:00:00+05:00",
    "2026-11-28T16:00:00+05:00",
    "Best Western Plus Atakent Park Hotel, Congress Hall",
    "42 Timiryazev Street, Building 10",
    "Almaty",
    "https://ohd.nu.edu.kz/nuday-almaty-en",
    null,
    "Admissions workshops, faculty talks and student experiences for prospective applicants and families."
  ],
  [
    "nu-demo-ealt-2026",
    "Eurasian Academic Libraries Training 2026",
    "Education",
    "2026-11-30T08:00:00+05:00",
    "2026-12-04T17:00:00+05:00",
    "NU Library, Block 5, Room E.438",
    "53 Kabanbay Batyr Avenue",
    "Astana",
    "https://nu.edu.kz/eventsm/eurasian-academic-libraries-training-2026/",
    "https://nu.edu.kz/wp-content/uploads/2026/11/1-1-768x432.png",
    "Professional training on AI, innovation and the changing role of academic libraries."
  ],
  [
    "nu-demo-impact-central-2026",
    "Impact Central 2026: The ABCD Way",
    "Business",
    "2026-12-04T09:00:00+05:00",
    "2026-12-05T17:00:00+05:00",
    "Nazarbayev University",
    "53 Kabanbay Batyr Avenue",
    "Astana",
    "https://nu.edu.kz/eventsm/nu-graduate-schools-of-business-impact-central-the-abcd-way-2/",
    "https://nu.edu.kz/wp-content/uploads/2026/11/nugsb-impact-central-the-abcd-way-1280-x-720-piks.-1-768x432.png",
    "Conference on case-based teaching, research and applied learning."
  ],
  [
    "nu-demo-markethon-2026",
    "Markethon 8.0",
    "Technology",
    "2026-12-05T09:00:00+05:00",
    "2026-12-06T09:00:00+05:00",
    "Nazarbayev University",
    "53 Kabanbay Batyr Avenue",
    "Astana",
    "https://nu.edu.kz/eventsm/markethon-8-0-2/",
    "https://nu.edu.kz/wp-content/uploads/2026/11/5427072142555161689-assel-ultanbay-768x432.jpg",
    "A team hackathon tackling marketing, design and content challenges."
  ]
] as const;

async function main() {
  if (process.env.BILETFLOW_DEMO_CATALOG !== "1") {
    throw new Error("Set BILETFLOW_DEMO_CATALOG=1 only for the demonstration database");
  }
  const organizer = await prisma.user.findUnique({ where: { email: "organizer@biletflow.kz" } });
  if (!organizer || organizer.role !== "ORGANIZER") throw new Error("Demo organizer missing; initialize demo database first");
  for (const [slug, title, category, start, end, name, address, city, source, coverImageUrl, description] of events) {
    await prisma.$transaction(async (tx) => {
      if (await tx.event.findUnique({ where: { slug }, select: { id: true } })) return;
      const venue = await tx.venue.findFirst({ where: { name, address, city } }) ??
        await tx.venue.create({ data: { name, address, city } });
      await tx.event.create({ data: {
        slug, title, category, coverImageUrl, organizerId: organizer.id, venueId: venue.id,
        description: description + "\n\nBiletFlow coursework demo only. Not official registration. Demo ticket inventory and prices are illustrative; end times may be estimates. Official information: " + source,
        startsAt: new Date(start), endsAt: new Date(end), timezone: "Asia/Almaty",
        status: "PUBLISHED", visibility: "PUBLIC", publishedAt: new Date(),
        registrationClosesAt: new Date(start), capacity: 100,
        ticketTypes: { create: { name: "Demo admission", priceKzt: 0, quantity: 100, maxPerOrder: 4 } },
      } });
    });
  }
  console.log("Five NU demonstration listings are available. Existing data was preserved.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
