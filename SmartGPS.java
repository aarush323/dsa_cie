import static spark.Spark.*;
import java.util.*;

public class SmartGPS {

    /**
     * TEXTBOOK DATA STRUCTURES
     */
    static class Location {
        String name;
        int x, y, id; // Node ID for Adjacency List

        Location(String name, int x, int y, int id) {
            this.name = name;
            this.x = x;
            this.y = y;
            this.id = id;
        }
    }

    static class Edge {
        int v; // Target node ID
        double w; // Weight

        Edge(int v, double w) {
            this.v = v;
            this.w = w;
        }
    }

    static class RouteNode {
        int u;
        double dist;

        RouteNode(int u, double dist) {
            this.u = u;
            this.dist = dist;
        }
    }

    static class Graph {
        // FORMAL ADJACENCY LIST: List of Lists (indexed by node ID)
        List<List<Edge>> adj = new ArrayList<>();
        List<Location> locations = new ArrayList<>();
        Map<String, Integer> nameToId = new HashMap<>();

        void addLocation(String name, int x, int y) {
            int id = locations.size();
            Location loc = new Location(name, x, y, id);
            locations.add(loc);
            nameToId.put(name, id);
            adj.add(new ArrayList<>());
        }

        void addEdge(String a, String b, double weight) {
            int u = nameToId.get(a);
            int v = nameToId.get(b);
            adj.get(u).add(new Edge(v, weight));
            adj.get(v).add(new Edge(u, weight));
        }

        /**
         * PURE DIJKSTRA (Explain this in your viva!)
         * Matches your snippet exactly.
         */
        public Map<String, Object> findShortestPath(String srcName, String destName, double tM, double wM, String eK) {
            int n = locations.size();
            int src = nameToId.get(srcName);
            int dest = nameToId.get(destName);

            double[] dist = new double[n]; // Integer/Double array for distances
            int[] parent = new int[n]; // To store shortest path tree
            boolean[] visited = new boolean[n];

            Arrays.fill(dist, Double.MAX_VALUE);
            Arrays.fill(parent, -1);

            // PriorityQueue with custom comparator: (a, b) -> dist[a] - dist[b]
            PriorityQueue<RouteNode> pq = new PriorityQueue<>((a, b) -> Double.compare(a.dist, b.dist));

            dist[src] = 0;
            pq.add(new RouteNode(src, 0));

            // Trace for UI (Noisy part hidden in helper)
            List<Map<String, Object>> trace = new ArrayList<>();

            while (!pq.isEmpty()) {
                RouteNode curr = pq.poll();
                int u = curr.u;

                if (visited[u])
                    continue;
                visited[u] = true;

                List<Map<String, Object>> stepRels = new ArrayList<>();

                // FOR EACH NEIGHBOR V OF U IN ADJACENCY LIST
                for (Edge edge : adj.get(u)) {
                    int v = edge.v;
                    double weight = getEffectiveWeight(u, v, edge.w, tM, wM, eK);

                    // RELAXATION: if (dist[u] + weight < dist[v])
                    if (dist[u] + weight < dist[v]) {
                        dist[v] = dist[u] + weight;
                        parent[v] = u;
                        pq.add(new RouteNode(v, dist[v]));
                        recordTrace(stepRels, u, v, weight, dist[v], true);
                    } else {
                        recordTrace(stepRels, u, v, weight, dist[v], false);
                    }
                }

                finalizeStepTrace(trace, u, dist[u], stepRels);
                if (u == dest)
                    break;
            }

            return buildResult(dist[dest], parent, src, dest, trace);
        }

        // --- DSA HELPERS ---

        private double getEffectiveWeight(int u, int v, double base, double tM, double wM, String eK) {
            String uName = locations.get(u).name;
            String vName = locations.get(v).name;
            String key = uName.compareTo(vName) < 0 ? uName + "-" + vName : vName + "-" + uName;
            boolean isAffected = (eK == null || eK.equals("all") || eK.equals(key));
            return base * (isAffected ? tM * wM : 1.0);
        }

        private void recordTrace(List<Map<String, Object>> list, int u, int v, double w, double total, boolean up) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("from", locations.get(u).name);
            r.put("to", locations.get(v).name);
            r.put("weight", (int) w);
            r.put("total", (int) total);
            r.put("updated", up);
            list.add(r);
        }

        private void finalizeStepTrace(List<Map<String, Object>> trace, int uId, double d,
                List<Map<String, Object>> rels) {
            Map<String, Object> step = new LinkedHashMap<>();
            step.put("node", locations.get(uId).name);
            step.put("distance", (int) d);
            step.put("relaxations", rels);
            trace.add(step);
        }

        private Map<String, Object> buildResult(double totalD, int[] parent, int src, int dest,
                List<Map<String, Object>> trace) {
            List<String> path = new ArrayList<>();
            if (totalD == Double.MAX_VALUE) {
                Map<String, Object> emp = new LinkedHashMap<>();
                emp.put("path", path);
                emp.put("totalDistance", -1);
                emp.put("trace", trace);
                emp.put("shortestPathEdges", new ArrayList<>());
                return emp;
            }
            int curr = dest;
            while (curr != -1) {
                path.add(locations.get(curr).name);
                curr = parent[curr];
            }
            Collections.reverse(path);

            List<String> spEdges = new ArrayList<>();
            for (int i = 0; i < path.size() - 1; i++) {
                String a = path.get(i), b = path.get(i + 1);
                spEdges.add(a.compareTo(b) < 0 ? a + "-" + b : b + "-" + a);
            }

            Map<String, Object> res = new LinkedHashMap<>();
            res.put("path", path);
            res.put("totalDistance", (int) totalD);
            res.put("trace", trace);
            res.put("shortestPathEdges", spEdges);
            return res;
        }

        String toJson() {
            StringBuilder sb = new StringBuilder("{\"nodes\":[");
            for (int i = 0; i < locations.size(); i++) {
                Location l = locations.get(i);
                if (i > 0)
                    sb.append(",");
                sb.append("{\"name\":\"").append(l.name).append("\",\"x\":").append(l.x).append(",\"y\":").append(l.y)
                        .append("}");
            }
            sb.append("],\"edges\":[");
            Set<String> d = new HashSet<>();
            boolean f = true;
            for (int u = 0; u < adj.size(); u++) {
                for (Edge e : adj.get(u)) {
                    String uN = locations.get(u).name, vN = locations.get(e.v).name;
                    String k = uN.compareTo(vN) < 0 ? uN + "-" + vN : vN + "-" + uN;
                    if (!d.contains(k)) {
                        d.add(k);
                        if (!f)
                            sb.append(",");
                        f = false;
                        sb.append("{\"from\":\"").append(uN).append("\",\"to\":\"").append(vN).append("\",\"weight\":")
                                .append((int) e.w).append("}");
                    }
                }
            }
            sb.append("]}");
            return sb.toString();
        }
    }

    public static void main(String[] args) {
        Graph g = new Graph();
        g.addLocation("PICT College", 80, 250);
        g.addLocation("Swargate", 220, 100);
        g.addLocation("Deccan", 220, 400);
        g.addLocation("Pune Station", 380, 100);
        g.addLocation("Kothrud", 380, 400);
        g.addLocation("Aundh", 520, 250);
        g.addEdge("PICT College", "Swargate", 4);
        g.addEdge("PICT College", "Deccan", 2);
        g.addEdge("Swargate", "Deccan", 1);
        g.addEdge("Swargate", "Pune Station", 5);
        g.addEdge("Deccan", "Pune Station", 8);
        g.addEdge("Deccan", "Kothrud", 10);
        g.addEdge("Pune Station", "Kothrud", 2);
        g.addEdge("Pune Station", "Aundh", 6);
        g.addEdge("Kothrud", "Aundh", 3);

        staticFiles.location("/public");
        get("/api/graph", (req, res) -> {
            res.type("application/json");
            return g.toJson();
        });
        post("/api/find-route", (req, res) -> {
            res.type("application/json");
            String s = req.queryParams("source"), d = req.queryParams("destination");
            if (s == null || d == null)
                return "{\"error\":\"fail\"}";
            String t = req.queryParams("traffic"), w = req.queryParams("weather"), e = req.queryParams("edge");
            double tm = "light".equals(t) ? 1.1
                    : "moderate".equals(t) ? 1.3 : "heavy".equals(t) ? 1.6 : "jam".equals(t) ? 2.0 : 1.0;
            double wm = "rain".equals(w) ? 1.2 : "heavy-rain".equals(w) ? 1.5 : "fog".equals(w) ? 1.35 : 1.0;
            return resultToJson(g.findShortestPath(s, d, tm, wm, e));
        });
    }

    static String resultToJson(Map<String, Object> r) {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"totalDistance\":").append(r.get("totalDistance")).append(",");
        sb.append("\"path\":[");
        List<String> path = (List<String>) r.get("path");
        for (int i = 0; i < path.size(); i++) {
            sb.append("\"").append(path.get(i)).append("\"").append(i < path.size() - 1 ? "," : "");
        }
        sb.append("],\"shortestPathEdges\":[");
        List<String> edges = (List<String>) r.get("shortestPathEdges");
        for (int i = 0; i < edges.size(); i++) {
            sb.append("\"").append(edges.get(i)).append("\"").append(i < edges.size() - 1 ? "," : "");
        }
        sb.append("],\"trace\":[");
        List<Map<String, Object>> trace = (List<Map<String, Object>>) r.get("trace");
        for (int i = 0; i < trace.size(); i++) {
            Map<String, Object> step = trace.get(i);
            sb.append("{\"node\":\"").append(step.get("node")).append("\",\"distance\":").append(step.get("distance"))
                    .append(",\"relaxations\":[");
            List<Map<String, Object>> rels = (List<Map<String, Object>>) step.get("relaxations");
            for (int j = 0; j < rels.size(); j++) {
                Map<String, Object> rel = rels.get(j);
                sb.append("{\"from\":\"").append(rel.get("from")).append("\",\"to\":\"").append(rel.get("to"))
                        .append("\",\"weight\":").append(rel.get("weight"))
                        .append(",\"total\":").append(rel.get("total")).append(",\"updated\":")
                        .append(rel.get("updated")).append("}").append(j < rels.size() - 1 ? "," : "");
            }
            sb.append("]}").append(i < trace.size() - 1 ? "," : "");
        }
        sb.append("]}");
        return sb.toString();
    }
}
