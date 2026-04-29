# Smart Pune Navigator

A prototype web application that visualizes real-time route optimization using Dijkstra's Algorithm. The prototype provides an interactive map to find the shortest path between interconnected locations in Pune.

## How It Works

This prototype is built using a Java backend and a vanilla HTML/CSS/JS frontend:

### Backend (`SmartGPS.java`)
- **Server:** Runs an embedded Jetty HTTP Server using the Java Spark Micro Framework.
- **Graph Model:** Locations (PICT College, Swargate, Deccan, etc.) and paths are represented as a weighted graph.
- **Routing Engine (DSA Perspective):** Implements **Dijkstra's Algorithm** to compute the single-source shortest path.
  - Utilizes a `PriorityQueue` (Min-Heap) to efficiently fetch the next unvisited node `u` with the smallest tentative distance.
  - Iterates through the neighbors of `u` and performs **edge relaxation**: if the path to a neighbor `v` through `u` is shorter than the currently known distance (`dist[u] + weight < dist[v]`), it updates `dist[v]`.
  - Upon a successful relaxation, `u` is recorded as the parent of `v` to reconstruct the final path, and the updated distance for `v` is pushed into the priority queue.
- **APIs:** Exposes two main REST endpoints:
  - `GET /api/graph`: Returns the structured graph data (nodes and edges).
  - `POST /api/find-route`: Accepts a `source` and `destination`, calculates the shortest path, and returns the constructed route along with a step-by-step algorithm trace.

### Frontend (`public/`)
- **Visualization:** Fetches the graph structure on load and draws it using SVG dynamically. Nodes can be selected from dropdowns or directly clicked on the map.
- **Interactivity:** Once the start and end points are set, it queries the backend's routing API.
- **Results:** Renders the computed path natively over the map and presents an intuitive modal that illustrates the exact algorithm progression trace.

## How to Run

1. **Compile the Backend**  
   Open your terminal in the project root and compile the Java code with the dependent libraries:
   ```bash
   javac -cp "lib/*" SmartGPS.java
   ```

2. **Run the Server**  
   Start the Java Spark server:
   ```bash
   java -cp ".:lib/*" SmartGPS
   ```

3. **Access the App**  
   Open your browser and navigate to `http://localhost:4567` to view the Smart Pune Navigator!

