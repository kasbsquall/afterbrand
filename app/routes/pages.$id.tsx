import { useParams } from "react-router";

import { PageDetail } from "@/components/queue/PageDetail";

export function meta() {
  return [{ title: "Page - Afterbrand" }];
}

export default function PageRoute() {
  const { id = "" } = useParams();
  return <PageDetail key={id} pageId={id} />;
}
