import 'support.dart';
import 'admin_activations.dart';
import 'admin_moderation.dart';
import 'admin_settings.dart';
import 'organizer_settings.dart';
import 'package:material_ui/material_ui.dart';
import '../core/session.dart';
import '../l10n/app_localizations.dart';
import '../l10n/locale_controller.dart';
import '../widgets/locale_switcher.dart';
import 'events_catalog.dart';
import 'my_tickets.dart';
import 'organizer.dart';
import 'scanner.dart';

class HomeScreen extends StatelessWidget {
  final Session session;
  final LocaleController locales;
  const HomeScreen({super.key, required this.session, required this.locales});
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.appName),
        actions: [
          LocaleSwitcher(controller: locales),
          IconButton(
            tooltip: l10n.signOut,
            onPressed: session.logout,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            l10n.welcome('${session.user?['name'] ?? ''}'),
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          Text(session.role),
          const SizedBox(height: 16),
          Card(
            child: ListTile(
              leading: const Icon(Icons.explore),
              title: Text(l10n.browseEvents),
              subtitle: Text(l10n.browseEventsSubtitle),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => EventsCatalogScreen(api: session.api),
                ),
              ),
            ),
          ),
          Card(
            child: ListTile(
              leading: const Icon(Icons.confirmation_number_outlined),
              title: Text(l10n.myTickets),
              subtitle: Text(l10n.myTicketsSubtitle),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => MyTicketsScreen(api: session.api),
                ),
              ),
            ),
          ),
          if (session.role == 'ORGANIZER')
            Card(
              child: ListTile(
                leading: const Icon(Icons.event),
                title: Text(l10n.myEvents),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => OrganizerScreen(api: session.api),
                  ),
                ),
              ),
            ),
          Card(
            child: ListTile(
              leading: const Icon(Icons.support_agent),
              title: Text(l10n.support),
              onTap: () => Navigator.push(context, MaterialPageRoute(
                builder: (_) => SupportScreen(api: session.api),
              )),
            ),
          ),
          if (session.role == 'PLATFORM_ADMIN')
            Card(
              child: ListTile(
                leading: const Icon(Icons.admin_panel_settings),
                title: const Text('Paid-sales reviews'),
                onTap: () => Navigator.push(context, MaterialPageRoute(
                  builder: (_) => AdminActivations(api: session.api),
                )),
              ),
            ),
          if (session.role == 'PLATFORM_ADMIN')
            Card(child: ListTile(
              leading: const Icon(Icons.manage_search),
              title: Text(adminLabel(context, 'Moderation', 'Модерация', 'Модерация')),
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => AdminModeration(api: session.api))),
            )),
          if (session.role == 'ORGANIZER')
            Card(child: ListTile(
              leading: const Icon(Icons.settings),
              title: Text(adminLabel(context,'Organizer settings','Настройки организатора','Ұйымдастырушы баптаулары')),
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => OrganizerSettings(api: session.api))),
            )),
          if (session.role == 'PLATFORM_ADMIN')
            Card(child: ListTile(
              leading: const Icon(Icons.settings),
              title: Text(adminLabel(context,'Platform settings','Настройки платформы','Платформа баптаулары')),
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => AdminSettings(api: session.api))),
            )),
          if (session.canScan)
            Card(
              child: ListTile(
                leading: const Icon(Icons.qr_code_scanner),
                title: Text(l10n.scanTicket),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => ScannerScreen(session: session),
                  ),
                ),
              ),
            ),
          Card(
            child: ListTile(
              leading: const Icon(Icons.person_outline),
              title: Text(l10n.account),
              subtitle: Text('${session.user?['email'] ?? ''}'),
            ),
          ),
        ],
      ),
    );
  }
}
