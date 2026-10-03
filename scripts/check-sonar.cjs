const fs = require("node:fs");
(async () => {
  const host = process.env.SONAR_HOST_URL || "https://sonarcloud.io";
  if (!process.env.SONAR_PROJECT_KEY || !process.env.SONAR_TOKEN)
    throw new Error("Configure proyecto y token Sonar");
  const url = new URL("/api/measures/component", host);
  url.searchParams.set("component", process.env.SONAR_PROJECT_KEY);
  url.searchParams.set("metricKeys", "bugs,vulnerabilities,security_hotspots");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.SONAR_TOKEN}` },
  });
  if (!response.ok) throw new Error(`Sonar HTTP ${response.status}`);
  const data = await response.json();
  fs.writeFileSync("sonar-measures.json", JSON.stringify(data, null, 2));
  for (const key of ["bugs", "vulnerabilities", "security_hotspots"]) {
    const measure = data.component.measures.find((m) => m.metric === key);
    if (!measure || Number(measure.value) !== 0)
      throw new Error(
        `Se exige cero ${key}; recibido ${measure?.value ?? "sin evidencia"}`,
      );
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
