import 'package:material_ui/material_ui.dart';

import '../core/session.dart';
import '../l10n/app_localizations.dart';
import '../l10n/locale_controller.dart';
import '../widgets/brand_mark.dart';
import '../widgets/locale_switcher.dart';
import 'account_access.dart';
import 'admin_activations.dart';
import 'admin_moderation.dart';
import 'admin_settings.dart';
import 'events_catalog.dart';
import 'my_tickets.dart';
import 'notifications.dart';
import 'organizer.dart';
import 'organizer_settings.dart';
import 'scanner.dart';
import 'support.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.session, required this.locales});
  final Session session;
  final LocaleController locales;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _index = 0;
  final _visited = <int>{0};

  @override
  Widget build(BuildContext context) {
    final session = widget.session;
    final api = session.api;
    final l10n = AppLocalizations.of(context);
    final organizer = session.role == 'ORGANIZER';
    final admin = session.role == 'PLATFORM_ADMIN';
    final hasWorkspace = organizer || admin || session.canScan;
    final active = hasWorkspace || _index < 3 ? _index : 2;

    Widget action(String label, IconData icon, Widget Function() page) {
      return Card(
        child: ListTile(
          leading: Icon(icon),
          title: Text(label),
          trailing: const Icon(Icons.chevron_right),
          onTap: () async {
            await Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => page()),
            );
          },
        ),
      );
    }

    final sections = <Widget>[
      EventsCatalogScreen(api: api, locales: widget.locales),
      MyTicketsScreen(api: api),
      Scaffold(
        appBar: AppBar(
          title: Text(l10n.account),
          actions: [LocaleSwitcher(controller: widget.locales)],
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: ListTile(
                leading: const CircleAvatar(child: Icon(Icons.person_outline)),
                title: Text('${session.user?['name'] ?? ''}'),
                subtitle: Text('${session.user?['email'] ?? ''}'),
              ),
            ),
            if (session.user?['emailVerified'] == true)
              ListTile(
                leading: const Icon(Icons.verified_outlined),
                title: Text(l10n.emailVerified),
              )
            else
              action(
                l10n.verifyEmail,
                Icons.mark_email_unread_outlined,
                () => VerifyEmailScreen(session: session),
              ),
            action(
              l10n.support,
              Icons.support_agent,
              () => SupportScreen(api: api),
            ),
            action(
              switch (Localizations.localeOf(context).languageCode) {
                'ru' => 'Уведомления',
                'kk' => 'Хабарламалар',
                _ => 'Notifications',
              },
              Icons.notifications_none,
              () => NotificationsScreen(api: api),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: session.logout,
              icon: const Icon(Icons.logout),
              label: Text(l10n.signOut),
            ),
          ],
        ),
      ),
      if (hasWorkspace)
        Scaffold(
          appBar: AppBar(title: const BrandMark()),
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                l10n.workspace,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 12),
              if (organizer) ...[
                action(
                  l10n.myEvents,
                  Icons.event_outlined,
                  () => OrganizerScreen(api: api),
                ),
                action(
                  adminLabel(
                    context,
                    'Organizer settings',
                    'Настройки организатора',
                    'Ұйымдастырушы баптаулары',
                  ),
                  Icons.settings_outlined,
                  () => OrganizerSettings(api: api),
                ),
              ],
              if (admin) ...[
                action(
                  l10n.paidSalesReviews,
                  Icons.fact_check_outlined,
                  () => AdminActivations(api: api),
                ),
                action(
                  adminLabel(context, 'Moderation', 'Модерация', 'Модерация'),
                  Icons.manage_search,
                  () => AdminModeration(api: api),
                ),
                action(
                  adminLabel(
                    context,
                    'Platform settings',
                    'Настройки платформы',
                    'Платформа баптаулары',
                  ),
                  Icons.settings_outlined,
                  () => AdminSettings(api: api),
                ),
              ],
              if (session.canScan)
                action(
                  l10n.scanTicket,
                  Icons.qr_code_scanner,
                  () => ScannerScreen(session: session),
                ),
              action(
                l10n.support,
                Icons.support_agent,
                () => SupportScreen(api: api),
              ),
            ],
          ),
        ),
    ];

    return Scaffold(
      body: IndexedStack(
        index: active,
        children: [
          for (final (index, section) in sections.indexed)
            if (index == active || (index != 1 && _visited.contains(index)))
              section
            else
              const SizedBox.shrink(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: active,
        onDestinationSelected: (index) => setState(() {
          _visited.add(index);
          _index = index;
        }),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.explore_outlined),
            label: l10n.discover,
          ),
          NavigationDestination(
            icon: const Icon(Icons.confirmation_number_outlined),
            label: l10n.myTickets,
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline),
            label: l10n.account,
          ),
          if (hasWorkspace)
            NavigationDestination(
              icon: const Icon(Icons.dashboard_outlined),
              label: l10n.workspace,
            ),
        ],
      ),
    );
  }
}
