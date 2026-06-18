import { NextResponse } from "next/server";
import { getUsers, getStaff } from "@/app/utils/db";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "users";

    let list = [];
    let filename = "atleti_clerk_import.csv";

    if (type === "staff") {
      list = await getStaff();
      filename = "staff_clerk_import.csv";
    } else {
      list = await getUsers();
    }
    
    // Intestazioni per Clerk: email_address, password, first_name, last_name, username
    let csvContent = "email_address,password,first_name,last_name,username\n";
    
    list.forEach(u => {
      // Per lo staff o atleti senza email, usiamo l'username o creiamo un valore di fallback
      const email = u.email || (u.username ? `${u.username}@bvi-staff.local` : "");
      const pass = u.password || "";
      
      // Gestione nome/cognome separati
      let nome = u.nome || "";
      let cognome = u.cognome || "";
      if (u.name && !nome) {
        // Se c'è solo "name" (es. nello staff), proviamo a dividerlo
        const parts = u.name.split(" ");
        nome = parts[0];
        cognome = parts.slice(1).join(" ");
      }
      
      const username = u.username || "";
      
      const cleanEmail = email.replace(/"/g, '""');
      const cleanPass = pass.replace(/"/g, '""');
      const cleanNome = nome.replace(/"/g, '""');
      const cleanCognome = cognome.replace(/"/g, '""');
      const cleanUsername = username.replace(/"/g, '""');
      
      csvContent += `"${cleanEmail}","${cleanPass}","${cleanNome}","${cleanCognome}","${cleanUsername}"\n`;
    });

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    });
  } catch (error) {
    console.error("Errore nell'esportazione:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
