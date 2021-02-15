import * as d3 from "d3";
import {
  DOMAIN,
  DOMAIN_DISCREET,
  UNCERTAINTY,
  MARGIN,
  WIDTH,
  HEIGHT,
  ORIGIN,
  DOT_DIAMETER,
  DOT_OPACITY,
  ARROW_PATHS,
  jitter,


  GRAPH_TYPE,


  DEFAULT_COLOR
} from "./constants";

const xScale = d3
  .scaleLinear()
  .domain(DOMAIN)
  .range([MARGIN.left, WIDTH - MARGIN.right]);
const yScale = d3
  .scaleLinear()
  .domain(DOMAIN)
  .range([HEIGHT - MARGIN.bottom, MARGIN.top]);
const xBand = d3
  .scaleBand()
  .domain(DOMAIN_DISCREET)
  .range([MARGIN.left, WIDTH - MARGIN.right]);
const yBand = d3
  .scaleBand()
  .domain(DOMAIN_DISCREET)
  .range([HEIGHT - MARGIN.bottom, MARGIN.top]);
export function makeOriginalCharts(data, questions, options) {
  // clean slate
  eraseViz();
  // iterate pairwise
  const charts = [];
  for (let idx = 0; idx < questions.length; idx += 2) {
    const columns = [questions[idx], questions[idx + 1]];
    charts.push(makeSingleChart(data, columns, options));
  }
  return charts;
}
function eraseViz() {
  d3.select(".container").selectAll("*").remove();
}
function makeSingleChart(
  data,
  columns,
  {
    size = DOT_DIAMETER,
    opacity = DOT_OPACITY,
    graph = GRAPH_TYPE.scatterplot,
    color = DEFAULT_COLOR,
  } = {}
) {
  // make new svg element
  const svg = d3
    .select(".container")
    .append("svg")
    .attr("viewBox", [0, 0, WIDTH, HEIGHT])
    .attr("width", WIDTH)
    .attr("height", HEIGHT);

  // draw data to it
  if (graph === GRAPH_TYPE.heatmap) {
    drawHeatMap(svg, data, columns, { color });
  } else if (graph === GRAPH_TYPE.scatterplot) {
    drawScatterplot(svg, data, columns, { size, opacity });
  }

  // draw axes, columns
  const xAxis = (g) => g
    .attr("transform", `translate(0, ${ORIGIN.y})`)
    .call(d3.axisBottom(xScale).ticks("").tickSizeOuter(0));

  const yAxis = (g) => g
    .attr("transform", `translate(${ORIGIN.x}, 0)`)
    .call(d3.axisLeft(yScale).ticks("").tickSizeOuter(0));

  const markers = (g) => g
    .attr("stroke", "none")
    .attr("fill", "black")
    .selectAll("path")
    .data(ARROW_PATHS)
    .join("path")
    .attr(
      "d",
      (d) => `M${d[0]} ${d[1]} L ${d[2]} ${d[3]} L ${d[4]} ${d[5]} Z`
    );

  svg.append("g").call(xAxis);
  svg.append("g").call(yAxis);

  svg
    .append("text")
    .attr("class", "xlabel")
    .attr("x", WIDTH - MARGIN.right / 2)
    .attr("y", ORIGIN.y)
    .attr("text-anchor", "middle")
    .attr("transform", `rotate(90, ${WIDTH - MARGIN.right / 2}, ${ORIGIN.y})`)
    .text(columns[0]);
  svg
    .append("text")
    .attr("class", "ylabel")
    .attr("x", ORIGIN.x)
    .attr("y", MARGIN.top / 2)
    .attr("transform", `translate(-100)`)
    .text(columns[1]);

  svg.append("g").call(markers);
}
function drawScatterplot(
  svg,
  data,
  columns,
  { size = DOT_DIAMETER, opacity = DOT_OPACITY } = {}
) {
  // clean slate
  svg.selectAll(".graphcontent").remove();
  // append dots
  svg
    .append("g")
    .attr("stroke-width", size)
    .attr("stroke", "black")
    .attr("stroke-opacity", opacity)
    .attr("stroke-linecap", "round")
    .selectAll("path")
    // filter out NAs
    .data(data.filter((d) => d[columns[0]] !== "NA" && d[columns[1]] !== "NA"))
    .join("path")
    .attr("class", "dot graphcontent")
    // apply jitter
    .attr(
      "d",
      (d) => `M${xScale(d[columns[0]] + jitter())}, ${yScale(
        d[columns[1]] + jitter()
      )}h0`
    );
}
export function updateDots({ size = DOT_DIAMETER, opacity = DOT_OPACITY } = {}) {
  d3.selectAll(".dot")
    .attr("stroke-width", size)
    .attr("stroke-opacity", opacity);
}
// heatmap
function drawHeatMap(svg, data, columns, options) {
  // calc heatmap values (totals answers per grid zone (UNCERTAINTY*2 by UNCERTAINTY*2))
  const heatmap = getHeatmapFrom(data, columns);
  let min = Infinity,
    mid,
    max = -Infinity;
  for (let { value } of heatmap) {
    let n = value;
    min = n < min ? n : min;
    max = n > max ? n : max;
  }
  mid = Math.round(max - min) / 2;
  const color = d3.scaleSequential(d3[options.color]).domain([min, mid, max]);

  svg.selectAll(".graphcontent").remove();
  svg
    .append("g")
    .attr("stroke-width", "1.5")
    .selectAll("rect")
    .data(heatmap)
    .join("rect")
    .attr("class", "rect graphcontent")
    .attr("x", (d) => xScale(d.x - UNCERTAINTY))
    .attr("y", (d) => yScale(d.y + UNCERTAINTY))
    .attr("width", xBand.bandwidth())
    .attr("height", yBand.bandwidth())
    .attr("stroke", (d) => color(d.value))
    .attr("fill", (d) => color(d.value));
}
const binValue = (n) => Math.floor(n);
const toPairStr = (xy) => `${binValue(xy[0])},${binValue(xy[1])}`;
function getHeatmapFrom(data, columns) {
  const totals = {};
  for (let row of data) {
    const xValue = row[columns[0]];
    const yValue = row[columns[1]];
    if (xValue === "NA" || yValue === "NA")
      continue;
    const coord = toPairStr([xValue, yValue]);
    if (totals[coord] == null)
      totals[coord] = 0;
    totals[coord] += 1;
  }
  const heatmap = [];
  for (let total in totals) {
    const [x, y] = total.split(",").map((t) => +t);
    heatmap.push({ x, y, value: totals[total] });
  }
  return heatmap;
}
export function newCustomChart(data, columns, options) {
  if (columns == null)
    return;
  const [x, y] = columns;
  if (x == null || y == null)
    return;
  eraseViz();
  makeSingleChart(data, columns, options);
}
