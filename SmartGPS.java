import static spark.Spark.*;
import java.util.*;

public class SmartGPS {

    static class Location {
        String name;
        int x, y;

        Location(String name, int x, int y) {
            this.name = name;
            this.x = x;
            this.y = y;
        }
    }

    static class Edge {
        String to;
        double weight;

        Edge(String to, double weight) {
            this.to = to;
            this.weight = weight;
        }
    }

    static class RouteNode implements Comparable<RouteNode> {
        String name;
        double dist;

        RouteNode(String name, double dist) {
            this.name = name;
            this.dist = dist;
        }

        @Override
        public int compareTo(RouteNode other) {
            return Double.compare(this.dist, other.dist);
        }
    }

    static class Graph {
        Map<String, List<Edge>> adj = new HashMap<>();
        List<Location> allLocations = new ArrayList<>();

        void addLocation(Location loc) {
            adj.put(loc.name, new ArrayList<>());
            allLocations.add(loc);
        }

        void addEdge(String a, String b, double weight) {
            adj.get(a).add(new Edge(b, weight));
            adj.get(b).add(new Edge(a, weight));
        }

        Map<String, Object> findShortestPath(String source, String destination) {
            Map<String, Double> dist = new HashMap<>();
            Map<String, String> parent = new HashMap<>();
            PriorityQueue<RouteNode> pq = new PriorityQueue<>();
            Set<String> visited = new LinkedHashSet<>();
            List<Map<String, Object>> trace = new ArrayList<>();

            for (Location loc : allLocations) {
                dist.put(loc.name, Double.POSITIVE_INFINITY);
            }
            dist.put(source, 0.0);
            pq.add(new RouteNode(source, 0.0));

            while (!pq.isEmpty()) {
                RouteNode current = pq.poll();
                String u = current.name;

                if (visited.contains(u)) continue;
                visited.add(u);

                List<Map<String, Object>> relaxations = new ArrayList<>();
                for (Edge e : adj.get(u)) {
                    if (!visited.contains(e.to)) {
                        double newDist = dist.get(u) + e.weight;
                        if (newDist < dist.get(e.to)) {
                            dist.put(e.to, newDist);
                            parent.put(e.to, u);
                            pq.add(new RouteNode(e.to, newDist));
                            Map<String, Object> r = new LinkedHashMap<>();
                            r.put("from", u);
                            r.put("to", e.to);
                            r.put("weight", (int) e.weight);
                            r.put("total", (int) newDist);
                            r.put("updated", true);
                            relaxations.add(r);
                        }
                    }
                }

                if (relaxations.isEmpty()) {
                    Map<String, Object> r = new LinkedHashMap<>();
                    r.put("from", u);
                    r.put("to", "");
                    r.put("weight", 0);
                    r.put("total", (int) (double) dist.get(u));
                    r.put("updated", false);
                    relaxations.add(r);
                }

                Map<String, Object> step = new LinkedHashMap<>();
                step.put("node", u);
                step.put("distance", (int) (double) dist.get(u));
                step.put("relaxations", relaxations);
                trace.add(step);

                if (u.equals(destination)) break;
            }

            List<String> path = new ArrayList<>();
            String current = destination;
            if (dist.get(destination) == Double.POSITIVE_INFINITY) {
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("path", new ArrayList<String>());
                result.put("totalDistance", -1);
                result.put("trace", trace);
                result.put("shortestPathEdges", new ArrayList<String>());
                return result;
            }
            while (current != null) {
                path.add(current);
                current = parent.get(current);
            }
            Collections.reverse(path);

            List<String> spEdges = new ArrayList<>();
            for (int i = 0; i < path.size() - 1; i++) {
                String a = path.get(i), b = path.get(i + 1);
                spEdges.add(a.compareTo(b) < 0 ? a + "-" + b : b + "-" + a);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("path", path);
            result.put("totalDistance", (int) (double) dist.get(destination));
            result.put("trace", trace);
            result.put("shortestPathEdges", spEdges);
            return result;
        }

        String toJson() {
            StringBuilder sb = new StringBuilder("{\"nodes\":[");
            boolean first = true;
            for (Location loc : allLocations) {
                if (!first) sb.append(",");
                first = false;
                sb.append("{\"name\":\"").append(loc.name).append("\",\"x\":").append(loc.x).append(",\"y\":").append(loc.y).append("}");
            }
            sb.append("],\"edges\":[");
            Set<String> drawn = new HashSet<>();
            first = true;
            for (Location loc : allLocations) {
                for (Edge e : adj.get(loc.name)) {
                    String key = loc.name.compareTo(e.to) < 0 ? loc.name + "-" + e.to : e.to + "-" + loc.name;
                    if (!drawn.contains(key)) {
                        drawn.add(key);
                        if (!first) sb.append(",");
                        first = false;
                        sb.append("{\"from\":\"").append(loc.name).append("\",\"to\":\"").append(e.to).append("\",\"weight\":").append((int) e.weight).append("}");
                    }
                }
            }
            sb.append("]}");
            return sb.toString();
        }
    }

    static Graph buildMap() {
        Graph g = new Graph();

        g.addLocation(new Location("PICT College",  80,  250));
        g.addLocation(new Location("Swargate",     220, 100));
        g.addLocation(new Location("Deccan",        220, 400));
        g.addLocation(new Location("Pune Station",  380, 100));
        g.addLocation(new Location("Kothrud",       380, 400));
        g.addLocation(new Location("Aundh",         520, 250));

        g.addEdge("PICT College", "Swargate",     4);
        g.addEdge("PICT College", "Deccan",       2);
        g.addEdge("Swargate",     "Deccan",       1);
        g.addEdge("Swargate",     "Pune Station", 5);
        g.addEdge("Deccan",       "Pune Station", 8);
        g.addEdge("Deccan",       "Kothrud",     10);
        g.addEdge("Pune Station", "Kothrud",      2);
        g.addEdge("Pune Station", "Aundh",        6);
        g.addEdge("Kothrud",      "Aundh",        3);

        return g;
    }

    public static void main(String[] args) {
        Graph graph = buildMap();

        staticFiles.location("/public");

        get("/api/graph", (req, res) -> {
            res.type("application/json");
            return graph.toJson();
        });

        post("/api/find-route", (req, res) -> {
            res.type("application/json");
            String source = req.queryParams("source");
            String destination = req.queryParams("destination");

            if (source == null || destination == null) {
                res.status(400);
                return "{\"error\":\"Missing source or destination\"}";
            }

            return resultToJson(graph.findShortestPath(source, destination));
        });

        System.out.println("Smart Pune Navigator running at http://localhost:4567");
    }

    static String resultToJson(Map<String, Object> r) {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"path\":[");
        @SuppressWarnings("unchecked")
        List<String> path = (List<String>) r.get("path");
        for (int i = 0; i < path.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(path.get(i)).append("\"");
        }
        sb.append("],");
        sb.append("\"totalDistance\":").append(r.get("totalDistance")).append(",");
        sb.append("\"trace\":[");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> trace = (List<Map<String, Object>>) r.get("trace");
        for (int t = 0; t < trace.size(); t++) {
            if (t > 0) sb.append(",");
            Map<String, Object> step = trace.get(t);
            sb.append("{\"node\":\"").append(step.get("node")).append("\"");
            sb.append(",\"distance\":").append(step.get("distance"));
            sb.append(",\"relaxations\":[");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> relaxes = (List<Map<String, Object>>) step.get("relaxations");
            for (int j = 0; j < relaxes.size(); j++) {
                if (j > 0) sb.append(",");
                Map<String, Object> rl = relaxes.get(j);
                sb.append("{\"from\":\"").append(rl.get("from")).append("\"");
                sb.append(",\"to\":\"").append(rl.get("to")).append("\"");
                sb.append(",\"weight\":").append(rl.get("weight"));
                sb.append(",\"total\":").append(rl.get("total"));
                sb.append(",\"updated\":").append(rl.get("updated"));
                sb.append("}");
            }
            sb.append("]}");
        }
        sb.append("],");
        sb.append("\"shortestPathEdges\":[");
        @SuppressWarnings("unchecked")
        List<String> edges = (List<String>) r.get("shortestPathEdges");
        for (int i = 0; i < edges.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(edges.get(i)).append("\"");
        }
        sb.append("]}");
        return sb.toString();
    }
}
