import 'package:material_ui/material_ui.dart';
import '../core/api.dart';
import '../l10n/app_localizations.dart';
import 'admin_moderation.dart';

class OrganizerActivation extends StatefulWidget {
  const OrganizerActivation({super.key,required this.api,required this.eventId});
  final ApiClient api;
  final String eventId;
  @override
  State<OrganizerActivation> createState()=>_OrganizerActivationState();
}
class _OrganizerActivationState extends State<OrganizerActivation>{
  String get path=>'/api/organizer/events/${Uri.encodeComponent(widget.eventId)}/activation';
  late Future<Map<String,dynamic>> data=widget.api.get(path);
  bool busy=false;
  String? error;
  String tr(String en,String ru,String kk)=>adminLabel(context,en,ru,kk);
  void refresh()=>setState(()=>data=widget.api.get(path));
  Future<void> act(bool pay) async{
    if(busy)return;
    final choice=await showDialog<String>(context:context,builder:(ctx)=>AlertDialog(
      title:Text(pay?tr('Simulated payment','Тестовый платёж','Сынақ төлемі'):tr('Accept paid sales terms?','Принять условия платных продаж?','Ақылы сатылым шарттарын қабылдау керек пе?')),
      content:Text(pay?tr('No real money will move.','Реальных списаний нет.','Нақты ақша аударылмайды.'):tr('Paid sales require verification, a payout account and an activation fee.','Платные продажи требуют верификации, счёта и взноса.','Ақылы сатылымға растау, шот және жарна қажет.')),
      actions:[
        TextButton(onPressed:()=>Navigator.pop(ctx),child:Text(tr('Back','Назад','Артқа'))),
        if(pay) TextButton(onPressed:()=>Navigator.pop(ctx,'DECLINED'),child:Text(tr('Decline','Отклонить','Қабылдамау'))),
        if(pay) TextButton(onPressed:()=>Navigator.pop(ctx,'ABANDONED'),child:Text(tr('Abandon','Отменить платёж','Төлемнен бас тарту'))),
        FilledButton(onPressed:()=>Navigator.pop(ctx,'APPROVED'),child:Text(pay?tr('Approve','Одобрить','Мақұлдау'):tr('Accept','Принять','Қабылдау'))),
      ],
    ));
    if(!mounted||choice==null||busy)return;
    setState((){busy=true;error=null;});
    try{
      if(pay){
        final started=await widget.api.post('$path/pay-fee',{});
        final payment=started['payment'] as Map;
        await widget.api.post('$path/simulate',{'intentId':payment['intentId'],'outcome':choice});
      }else{
        await widget.api.post('$path/accept-terms',{});
      }
      if(mounted)refresh();
    }catch(e){
      if(mounted)setState(()=>error=AppLocalizations.of(context).apiError(e is ApiException?e.code:''));
    }finally{if(mounted)setState(()=>busy=false);}
  }
  @override
  Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:Text(tr('Paid sales activation','Активация платных продаж','Ақылы сатылымды іске қосу')),actions:[IconButton(onPressed:busy?null:refresh,icon:const Icon(Icons.refresh))]),
    body:FutureBuilder(future:data,builder:(context,snapshot){
      if(snapshot.connectionState==ConnectionState.waiting)return const Center(child:CircularProgressIndicator());
      if(snapshot.hasError||!snapshot.hasData)return Center(child:Text(AppLocalizations.of(context).apiError(snapshot.error is ApiException?(snapshot.error as ApiException).code:'')));
      final a=snapshot.data!['activation'] as Map;
      return ListView(padding:const EdgeInsets.all(16),children:[
        Text(tr('Activation fee (simulated)','Взнос (симуляция)','Жарна (сынақ)')),
        Text('${a['feeKzt']} KZT',style:Theme.of(context).textTheme.headlineSmall),
        for(final (key,label) in [
          ('feePaid',tr('Fee paid','Взнос оплачен','Жарна төленді')),
          ('identityVerified',tr('Identity approved','Личность подтверждена','Жеке тұлға расталды')),
          ('payoutAccountConnected',tr('Payout account connected','Счёт подключён','Төлем шоты қосылды')),
          ('termsAccepted',tr('Terms accepted','Условия приняты','Шарттар қабылданды')),
          ('activated',tr('Paid sales enabled','Продажи активированы','Сатылым қосылды')),
        ]) ListTile(leading:Icon(a[key]==true?Icons.check_circle:Icons.radio_button_unchecked),title:Text(label)),
        if(error!=null)Text(error!),
        if(busy)const LinearProgressIndicator(),
        if(a['termsAccepted']!=true)FilledButton(onPressed:busy?null:()=>act(false),child:Text(tr('Accept terms','Принять условия','Шарттарды қабылдау'))),
        if(a['feePaid']!=true)OutlinedButton(onPressed:busy?null:()=>act(true),child:Text(tr('Pay simulated fee','Оплатить тестовый взнос','Сынақ жарнасын төлеу'))),
      ]);
    }),
  );
}
