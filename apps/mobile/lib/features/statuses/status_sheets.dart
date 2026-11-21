import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Menu « … » de l’accueil.
Future<void> showHomeMenuSheet(BuildContext context, {required bool signedIn}) {
  return showModalBottomSheet<void>(
    context: context,
    // Navigateur racine : la feuille passe au-dessus de la barre d’onglets
    // du bas (et la masque) au lieu de s’afficher dans l’onglet courant.
    useRootNavigator: true,
    showDragHandle: true,
    useSafeArea: true,
    builder: (ctx) {
      void go(String path) {
        Navigator.of(ctx).pop();
        context.push(path);
      }

      return SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(LucideIcons.bell),
              title: const Text('Notifications'),
              onTap: () => go(signedIn ? '/notifications' : '/connexion'),
            ),
            if (signedIn)
              ListTile(
                leading: const Icon(LucideIcons.circleDot),
                title: const Text('Mes statuts'),
                onTap: () => go('/mes-statuts'),
              ),
            if (signedIn)
              ListTile(
                leading: const Icon(LucideIcons.shoppingBag),
                title: const Text('Mes achats'),
                onTap: () => go('/achats'),
              ),
            ListTile(
              leading: const Icon(LucideIcons.circleUser),
              title: Text(signedIn ? 'Mon profil' : 'Se connecter'),
              onTap: () => go(signedIn ? '/profil' : '/connexion'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      );
    },
  );
}
