import 'package:material_ui/material_ui.dart';
import '../core/api.dart';
import '../l10n/app_localizations.dart';
import 'admin_moderation.dart';

class AdminSettings extends StatefulWidget {
  const AdminSettings({super.key,required this.api});
  final ApiClient api;
  @override
  State<AdminSettings> createState()=>_AdminSettingsState();
}
class _AdminSettingsState extends State<AdminSettings>{
  final form=GlobalKey<FormState>();
  final fields={for(final key in ['activationFeeKzt','feePercent','feeFixedKzt','checkoutHoldMinutes']) key:TextEditingController()};
  bool busy=true,loaded=false;
  String? error;
  String tr(String en,String ru,String kk)=>adminLabel(context,en,ru,kk);
  @override
  void initState(){super.initState();load();}
  @override
  void dispose(){for(final controller in fields.values){controller.dispose();}super.dispose();}
  Future<void> load()async{
    try{
      final result=await widget.api.get('/api/admin/settings');
      if(!mounted)return;
      final settings=result['settings'] as Map;
      for(final key in fields.keys){fields[key]!.text='${settings[key]}';}
      setState(()=>loaded=true);
    }catch(e){if(mounted)setState(()=>error=e is ApiException?e.code:'REQUEST_FAILED');}
    finally{if(mounted)setState(()=>busy=false);}
  }
  Future<void> save()async{
    if(busy||!form.currentState!.validate())return;
    final confirmed=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(
      title:Text(tr('Update platform settings?','Обновить настройки платформы?','Платформа баптауларын жаңарту керек пе?')),
      actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:Text(tr('Cancel','Отмена','Бас тарту'))),FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:Text(tr('Save','Сохранить','Сақтау')))],
    ));
    if(!mounted||confirmed!=true)return;
    setState((){busy=true;error=null;});
    try{
      await widget.api.put('/api/admin/settings',{
        for(final key in fields.keys)key:key=='feePercent'?num.parse(fields[key]!.text):int.parse(fields[key]!.text),
      });
      if(mounted)await load();
    }catch(e){if(mounted)setState(()=>error=e is ApiException?e.code:'REQUEST_FAILED');}
    finally{if(mounted)setState(()=>busy=false);}
  }
  @override
  Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:Text(tr('Platform settings','Настройки платформы','Платформа баптаулары'))),
    body:Form(key:form,child:ListView(padding:const EdgeInsets.all(16),children:[
      if(busy)const LinearProgressIndicator(),
      if(error!=null)Text(AppLocalizations.of(context).apiError(error!)),
      for(final (key,label) in [
        ('activationFeeKzt',tr('Activation fee (KZT)','Взнос (KZT)','Жарна (KZT)')),
        ('feePercent',tr('Processing fee (%)','Комиссия (%)','Комиссия (%)')),
        ('feeFixedKzt',tr('Fixed fee (KZT)','Фиксированная комиссия (KZT)','Тұрақты комиссия (KZT)')),
        ('checkoutHoldMinutes',tr('Reservation (minutes)','Бронь (минуты)','Брондау (минут)')),
      ]) TextFormField(controller:fields[key],enabled:loaded&&!busy,decoration:InputDecoration(labelText:label),
        keyboardType:TextInputType.numberWithOptions(decimal:key=='feePercent'),
        validator:(v){
          final n=key=='feePercent'?num.tryParse(v??''):int.tryParse(v??'');
          final min=key=='activationFeeKzt'||key=='checkoutHoldMinutes'?1:0;
          final max=key=='feePercent'?100:key=='checkoutHoldMinutes'?1440:1000000;
          return n==null||!n.isFinite||n<min||n>max?tr('Invalid value','Недопустимое значение','Жарамсыз мән'):null;
        }),
      FilledButton(onPressed:loaded&&!busy?save:null,child:Text(tr('Save','Сохранить','Сақтау'))),
      if(!loaded&&!busy)OutlinedButton(onPressed:(){setState(()=>busy=true);load();},child:Text(tr('Retry','Повторить','Қайталау'))),
    ])),
  );
}
