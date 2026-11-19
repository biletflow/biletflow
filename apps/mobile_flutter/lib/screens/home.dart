import 'package:material_ui/material_ui.dart';
import '../core/session.dart';
import 'organizer.dart';
import 'scanner.dart';

class HomeScreen extends StatelessWidget {
  final Session session;
  const HomeScreen({super.key, required this.session});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('BiletFlow'), actions: [
      IconButton(tooltip: 'Sign out', onPressed: session.logout, icon: const Icon(Icons.logout)),
    ]),
    body: ListView(padding: const EdgeInsets.all(16), children: [
      Text('Welcome, ${session.user?['name'] ?? ''}', style: Theme.of(context).textTheme.headlineSmall),
      const SizedBox(height: 8), Text(session.role), const SizedBox(height: 16),
      if (session.role == 'ORGANIZER') Card(child: ListTile(leading: const Icon(Icons.event), title: const Text('My events'), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => OrganizerScreen(api: session.api))))),
      if (session.canScan) Card(child: ListTile(leading: const Icon(Icons.qr_code_scanner), title: const Text('Scan ticket'), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ScannerScreen(session: session))))),
      Card(child: ListTile(leading: const Icon(Icons.person_outline), title: const Text('Account'), subtitle: Text('${session.user?['email'] ?? ''}'))),
      const Padding(padding: EdgeInsets.all(12), child: Text('Development build: other role-specific modules are not yet implemented.')),
    ]),
  );
}
