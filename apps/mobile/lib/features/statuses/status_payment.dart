import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../theme/app_theme.dart';

/// Attend la confirmation d’un paiement Mobile Money (FlexPaie).
///
/// Interroge l’API toutes les 3 s pendant ~1 min. Renvoie `true` si le
/// paiement est confirmé, `false` s’il est toujours en attente (l’abonné
/// pourra vérifier plus tard dans « Mes statuts ») ; lève une exception si
/// le paiement a échoué.
Future<bool> waitForStatusPayment(
  ApiClient api,
  String paymentId, {
  bool Function()? cancelled,
}) async {
  if (paymentId.isEmpty) return false;
  for (var i = 0; i < 20; i++) {
    await Future<void>.delayed(const Duration(seconds: 3));
    if (cancelled?.call() ?? false) return false;
    final status = await api.checkPayment(paymentId);
    final s = '${status['status'] ?? ''}'.toUpperCase();
    if (s == 'SUCCESS' || s == 'PAID' || s == 'SUCCEEDED') return true;
    if (s == 'FAILED' || s == 'CANCELLED' || s == 'CANCELED') {
      throw Exception('Paiement refusé ou annulé');
    }
  }
  return false;
}

/// Champ « Numéro Mobile Money » (format 243…).
class MobileMoneyField extends StatelessWidget {
  const MobileMoneyField({
    super.key,
    required this.controller,
    this.enabled = true,
  });

  final TextEditingController controller;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      enabled: enabled,
      keyboardType: TextInputType.phone,
      autofillHints: const [AutofillHints.telephoneNumber],
      decoration: const InputDecoration(
        labelText: 'Numéro Mobile Money',
        hintText: '243 8X XXX XXXX',
        helperText: 'M-Pesa, Orange Money ou Airtel Money',
      ),
    );
  }
}

/// Ligne d’état (envoi, paiement en cours…) avec indicateur.
class StatusProgressLine extends StatelessWidget {
  const StatusProgressLine({super.key, required this.text, this.progress});

  final String text;

  /// 0..1 pour un envoi de fichier ; null = indéterminé
  final double? progress;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LinearProgressIndicator(
          value: progress,
          color: AppTheme.gold,
          minHeight: 3,
          borderRadius: BorderRadius.circular(2),
        ),
        const SizedBox(height: 8),
        Text(
          text,
          textAlign: TextAlign.center,
          style: AppTheme.sansText(size: 13.5, height: 1.35),
        ),
      ],
    );
  }
}
