import java.util.*;

// --- Basic Patient Record ---
class Patient {
    int id;
    String name;
    String diag; // Diagnosis
    String bill;

    Patient(int id, String n, String d, String b) {
        this.id = id;
        this.name = n;
        this.diag = d;
        this.bill = b;
    }
}

// --- Basic B-Tree Node ---
class Node {
    int[] id_list;
    Patient[] data_list;
    Node[] children;
    int count;
    boolean leaf;

    Node(int t, boolean leaf) {
        this.id_list = new int[2 * t - 1];
        this.data_list = new Patient[2 * t - 1];
        this.children = new Node[2 * t];
        this.count = 0;
        this.leaf = leaf;
    }
}

// --- B-Tree Logic ---
class BTree {
    Node root;
    int deg; // Minimum degree

    BTree(int deg) {
        this.deg = deg;
        this.root = null;
    }

    // Exact Search
    void search(Node x, int id) {
        if (x == null) {
            System.out.println("Record not found.");
            return;
        }

        int i = 0;
        while (i < x.count && id > x.id_list[i]) {
            i++;
        }

        if (i < x.count && id == x.id_list[i]) {
            Patient p = x.data_list[i];
            System.out.println("Found: " + p.name + " | Diag: " + p.diag + " | Bill: " + p.bill);
            return;
        }

        if (x.leaf) {
            System.out.println("Record not found.");
            return;
        }

        search(x.children[i], id);
    }

    // Basic Insert
    void insert(int id, Patient p) {
        if (root == null) {
            root = new Node(deg, true);
            root.id_list[0] = id;
            root.data_list[0] = p;
            root.count = 1;
        } else {
            if (root.count == 2 * deg - 1) {
                Node s = new Node(deg, false);
                s.children[0] = root;
                split(s, 0, root);
                int i = 0;
                if (s.id_list[0] < id)
                    i++;
                insertNonFull(s.children[i], id, p);
                root = s;
            } else {
                insertNonFull(root, id, p);
            }
        }
    }

    void insertNonFull(Node x, int k, Patient p) {
        int i = x.count - 1;
        if (x.leaf) {
            while (i >= 0 && x.id_list[i] > k) {
                x.id_list[i + 1] = x.id_list[i];
                x.data_list[i + 1] = x.data_list[i];
                i--;
            }
            x.id_list[i + 1] = k;
            x.data_list[i + 1] = p;
            x.count++;
        } else {
            while (i >= 0 && x.id_list[i] > k)
                i--;
            i++;
            if (x.children[i].count == 2 * deg - 1) {
                split(x, i, x.children[i]);
                if (x.id_list[i] < k)
                    i++;
            }
            insertNonFull(x.children[i], k, p);
        }
    }

    void split(Node x, int i, Node y) {
        Node z = new Node(deg, y.leaf);
        z.count = deg - 1;
        for (int j = 0; j < deg - 1; j++) {
            z.id_list[j] = y.id_list[j + deg];
            z.data_list[j] = y.data_list[j + deg];
        }
        if (!y.leaf) {
            for (int j = 0; j < deg; j++)
                z.children[j] = y.children[j + deg];
        }
        y.count = deg - 1;
        for (int j = x.count; j >= i + 1; j--)
            x.children[j + 1] = x.children[j];
        x.children[i + 1] = z;
        for (int j = x.count - 1; j >= i; j--) {
            x.id_list[j + 1] = x.id_list[j];
            x.data_list[j + 1] = x.data_list[j];
        }
        x.id_list[i] = y.id_list[deg - 1];
        x.data_list[i] = y.data_list[deg - 1];
        x.count++;
    }

    // Show all records (In-order)
    void show(Node x) {
        if (x == null)
            return;
        for (int i = 0; i < x.count; i++) {
            if (!x.leaf)
                show(x.children[i]);
            Patient p = x.data_list[i];
            System.out.println("ID: " + p.id + " | Name: " + p.name);
        }
        if (!x.leaf)
            show(x.children[x.count]);
    }

    // Range Search
    void range(Node x, int low, int high) {
        if (x == null)
            return;
        for (int i = 0; i < x.count; i++) {
            if (!x.leaf)
                range(x.children[i], low, high);
            if (x.id_list[i] >= low && x.id_list[i] <= high) {
                System.out.println("ID: " + x.id_list[i] + " | Name: " + x.data_list[i].name);
            }
        }
        if (!x.leaf)
            range(x.children[x.count], low, high);
    }
}

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        BTree btree = new BTree(2); // Order fixed at 2 for simplicity

        while (true) {
            System.out.println("\n1: Add 2: Search 3: Show 4: Range 5: Exit");
            int choice = sc.nextInt();
            if (choice == 5)
                break;

            if (choice == 1) {
                System.out.print("ID: ");
                int id = sc.nextInt();
                System.out.print("Name: ");
                String n = sc.next();
                System.out.print("Diag: ");
                String d = sc.next();
                System.out.print("Bill: ");
                String b = sc.next();
                btree.insert(id, new Patient(id, n, d, b));
            } else if (choice == 2) {
                System.out.print("ID to search: ");
                int sid = sc.nextInt();
                btree.search(btree.root, sid);
            } else if (choice == 3) {
                System.out.println("All Records:");
                btree.show(btree.root);
            } else if (choice == 4) {
                System.out.print("Lower ID: ");
                int low = sc.nextInt();
                System.out.print("Upper ID: ");
                int high = sc.nextInt();
                btree.range(btree.root, low, high);
            }
        }
    }
}
