import 'package:material_ui/material_ui.dart';
import '../core/api.dart';
import '../l10n/app_localizations.dart';
import 'admin_moderation.dart';
import 'organizer_editor.dart';

class OrganizerSettings extends StatefulWidget {
  const OrganizerSettings({super.key, required this.api});
  final ApiClient api;
  @override
  State<OrganizerSettings> createState() => _OrganizerSettingsState();
}
class _OrganizerSettingsState extends State<OrganizerSettings> {
  late Future<List<Map<String,dynamic>>> data = load();
  bool busy = false;
  Future<List<Map<String,dynamic>>> load() => Future.wait([
    widget.api.get('/api/organizer/profile'),
    widget.api.get('/api/organizer/payout-accounts'),
    widget.api.get('/api/organizer/payouts'),
  ]);
  String tr(String en,String ru,String kk) => adminLabel(context,en,ru,kk);
  void refresh() => setState(() => data = load());
  Future<void> edit(String title,List<EditorField> fields,Map<String,dynamic> initial,Future<Object?> Function(Map<String,dynamic>) save) async {
    final changed = await Navigator.push<bool>(context,MaterialPageRoute(builder: (_) => OrganizerEditor(title:title,fields:fields,initial:initial,save:save)));
    if(mounted && changed == true) refresh();
  }
  Future<void> verify() async {
    final yes = await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(
      title:Text(tr('Submit simulated identity verification?','Отправить тестовую верификацию?','Сынақ сәйкестендіруін жіберу керек пе?')),
      content:Text(tr('Do not submit real documents.','Не отправляйте реальные документы.','Нақты құжаттарды жібермеңіз.')),
      actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:Text(tr('Cancel','Отмена','Бас тарту'))),
        FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:Text(tr('Submit','Отправить','Жіберу')))],
    ));
    if(!mounted || yes != true || busy) return;
    setState(()=>busy=true);
    try {
      await widget.api.post('/api/organizer/verification',{'documentName':'Demo identity'});
      if(mounted) refresh();
    } catch(e) {
      if(mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(AppLocalizations.of(context).apiError(e is ApiException ? e.code : ''))));
    } finally { if(mounted) setState(()=>busy=false); }
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar:AppBar(title:Text(tr('Organizer settings','Настройки организатора','Ұйымдастырушы баптаулары')),actions:[IconButton(onPressed:refresh,icon:const Icon(Icons.refresh))]),
    body:FutureBuilder(future:data,builder:(context,snapshot){
      if(snapshot.connectionState==ConnectionState.waiting) return const Center(child:CircularProgressIndicator());
      if(snapshot.hasError || !snapshot.hasData) return Center(child:Text(AppLocalizations.of(context).apiError(snapshot.error is ApiException ? (snapshot.error as ApiException).code : '')));
      final profile = Map<String,dynamic>.from(snapshot.data![0]['profile'] as Map);
      final accounts = snapshot.data![1]['accounts'] as List;
      final payouts = snapshot.data![2]['payouts'] as List;
      return ListView(padding:const EdgeInsets.all(16),children:[
        Text('${profile['displayName'] ?? ''}',style:Theme.of(context).textTheme.headlineSmall),
        Text('${profile['contactEmail'] ?? ''}'),
        OutlinedButton(onPressed:busy?null:()=>edit(tr('Edit profile','Редактировать профиль','Профильді өңдеу'),[
          (key:'displayName',label:tr('Display name','Название','Атауы'),required:true,number:false),
          (key:'contactEmail',label:tr('Contact email','Email','Электрондық пошта'),required:true,number:false),
          (key:'description',label:tr('Description','Описание','Сипаттама'),required:false,number:false),
          (key:'contactPhone',label:tr('Phone','Телефон','Телефон'),required:false,number:false),
          (key:'websiteUrl',label:tr('Website','Сайт','Сайт'),required:false,number:false),
          (key:'logoUrl',label:tr('Logo URL','URL логотипа','Логотип URL'),required:false,number:false),
        ],{for(final k in ['displayName','contactEmail','description','contactPhone','websiteUrl','logoUrl']) if(profile[k]!=null) k:profile[k]},(body){
          body.removeWhere((key,value)=>value=='');
          return widget.api.put('/api/organizer/profile',body);
        }),child:Text(tr('Edit profile','Редактировать профиль','Профильді өңдеу'))),
        ListTile(title:Text(tr('Identity verification (simulated)','Верификация (симуляция)','Сәйкестендіру (сынақ)')),subtitle:Text('${profile['verificationStatus']}')),
        if(profile['id']!=null && profile['verificationStatus']!='APPROVED') OutlinedButton(onPressed:busy?null:verify,child:Text(tr('Submit demo verification','Отправить тестовую заявку','Сынақ өтінімін жіберу'))),
        const Divider(),
        Text(tr('Simulated payout accounts','Тестовые счета выплат','Сынақ төлем шоттары')),
        for(final row in accounts.whereType<Map>()) ListTile(title:Text('${row['bankName']}'),subtitle:Text("${row['holderName']} •••• ${row['ibanLast4']}")),
        OutlinedButton(onPressed:busy?null:()=>edit(tr('Add demo account','Добавить тестовый счёт','Сынақ шотын қосу'),[
          (key:'holderName',label:tr('Demo holder name','Тестовое имя владельца','Сынақ иесінің аты'),required:true,number:false),
          (key:'bankName',label:tr('Demo bank name','Тестовое название банка','Сынақ банк атауы'),required:true,number:false),
          (key:'ibanLast4',label:tr('Four demo digits only','Только 4 тестовые цифры','Тек 4 сынақ саны'),required:true,number:false),
        ],const {},(body)=>widget.api.post('/api/organizer/payout-accounts',body)),child:Text(tr('Add demo account','Добавить тестовый счёт','Сынақ шотын қосу'))),
        const Divider(),
        Text(tr('Payout history','История выплат','Төлем тарихы')),
        Text(tr('Saved simulated payout. Not recalculated from current sales, refunds, or fees.','Сохранённая тестовая выплата. Не пересчитывается из текущих продаж, возвратов и комиссий.','Сақталған сынақ төлем. Ағымдағы сатылым, қайтарым және комиссиядан қайта есептелмейді.')),
        for(final row in payouts.whereType<Map>()) ListTile(title:Text('${row['status']}'),subtitle:Text('${row['createdAt']}'),trailing:Text('${row['netKzt']} KZT')),
      ]);
    }),
  );
}
